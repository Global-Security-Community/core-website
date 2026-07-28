const { getAuthUser, hasRole, unauthorised, forbidden, extractEmail } = require('../helpers/auth');
const { logAudit } = require('../helpers/auditLog');
const { Octokit } = require('@octokit/rest');
const { createAppAuth } = require('@octokit/auth-app');

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?$/;

function getGitHubClient() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;

  if (!appId || !privateKey || !installationId || !owner || !repo) {
    throw new Error('GitHub App configuration is incomplete');
  }

  return {
    owner,
    repo,
    octokit: new Octokit({
      authStrategy: createAppAuth,
      auth: { appId, privateKey, installationId }
    })
  };
}

function parseReleaseDetails(request, body) {
  const url = new URL(request.url);
  const sha = String(body?.sha || url.searchParams.get('sha') || '').toLowerCase();
  const chapterSlug = String(body?.chapterSlug || url.searchParams.get('chapter') || '').toLowerCase();

  if (!SHA_PATTERN.test(sha) || !SLUG_PATTERN.test(chapterSlug)) {
    return null;
  }
  return { sha, chapterSlug };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function confirmationPage(sha, chapterSlug) {
  const owner = process.env.GITHUB_REPO_OWNER || 'Global-Security-Community';
  const repo = process.env.GITHUB_REPO_NAME || 'core-website';
  const reviewUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/live-version-swa...${sha}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Approve Production Release | Global Security Community</title>
  <link rel="stylesheet" href="/css/style.css">
  <script src="/js/release-approval.js" defer></script>
</head>
<body>
  <main class="container">
    <section class="card card-padding-standard">
      <h1>Approve production release</h1>
      <p>The generated <strong>${escapeHtml(chapterSlug)}</strong> chapter is ready on <code>main</code>.</p>
      <p>This approval releases every tested change through commit <code>${escapeHtml(sha)}</code>.</p>
      <p><a class="btn-secondary" href="${escapeHtml(reviewUrl)}" target="_blank" rel="noopener noreferrer">Review changes on GitHub</a></p>
      <button
        class="btn-primary"
        id="approve-release"
        type="button"
        data-sha="${escapeHtml(sha)}"
        data-chapter="${escapeHtml(chapterSlug)}"
      >Approve release</button>
      <p id="release-status" role="status" aria-live="polite"></p>
    </section>
  </main>
</body>
</html>`;
}

function jsonError(status, error) {
  return {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    jsonBody: { error }
  };
}

/**
 * GET/POST /api/releaseApproval
 * Admin-only confirmation and dispatch for a SHA-bound production release.
 */
module.exports = async function releaseApproval(request, context) {
  const user = getAuthUser(request);
  if (!user) return unauthorised();
  if (!hasRole(user, 'admin')) return forbidden('Only administrators can approve production releases');

  if (request.method === 'GET') {
    const details = parseReleaseDetails(request);
    if (!details) {
      return {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
        body: '<h1>Invalid release request</h1><p>Use the approval link from Discord.</p>'
      };
    }
    return {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
      body: confirmationPage(details.sha, details.chapterSlug)
    };
  }

  if (request.method !== 'POST') {
    return jsonError(405, 'Method not allowed');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Invalid JSON');
  }

  const details = parseReleaseDetails(request, body);
  if (!details) return jsonError(400, 'Invalid release SHA or chapter slug');

  try {
    const { octokit, owner, repo } = getGitHubClient();
    const mainRef = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
    const currentMainSha = mainRef.data.object.sha.toLowerCase();

    if (currentMainSha !== details.sha) {
      return jsonError(409, 'Main has changed since this approval was requested. Review the latest Discord request instead.');
    }

    const approvedBy = extractEmail(user) || user.userDetails || user.userId;
    await octokit.repos.createDispatchEvent({
      owner,
      repo,
      event_type: 'release-approved',
      client_payload: {
        expected_sha: details.sha,
        chapter_slug: details.chapterSlug,
        approved_by: 'authenticated administrator via Discord'
      }
    });

    logAudit('release', details.sha, 'production_release_approved', approvedBy, {
      chapterSlug: details.chapterSlug,
      sha: details.sha
    }, context);

    return {
      status: 202,
      headers: { 'Cache-Control': 'private, no-store' },
      jsonBody: {
        success: true,
        message: 'Release approved. Production checks are starting.'
      }
    };
  } catch (error) {
    context.log(`releaseApproval error: ${error.message}`);
    return jsonError(500, 'Unable to start the production release');
  }
};
