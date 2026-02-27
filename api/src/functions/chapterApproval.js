const { verifyApprovalToken } = require('../helpers/tokenHelper');
const { getApplication, updateApplicationStatus } = require('../helpers/tableStorage');
const { createChapterChannel } = require('../helpers/discordBot');
const { Octokit } = require('@octokit/rest');
const { createAppAuth } = require('@octokit/auth-app');

module.exports = async function (request, context) {
  context.log('Chapter approval request received');

  try {
    const url = new URL(request.url);
    const applicationId = url.searchParams.get('id');
    const action = url.searchParams.get('action');
    const token = url.searchParams.get('token');

    if (!applicationId || !action || !token) {
      return htmlResponse(400, 'Missing Parameters', 'Invalid approval link. Please use the link from Discord.');
    }

    if (action !== 'approve' && action !== 'reject') {
      return htmlResponse(400, 'Invalid Action', 'Action must be "approve" or "reject".');
    }

    // Verify the signed token
    let isValid;
    try {
      isValid = verifyApprovalToken(applicationId, action, token);
    } catch {
      return htmlResponse(403, 'Invalid Token', 'The approval token is invalid or has been tampered with.');
    }

    if (!isValid) {
      return htmlResponse(403, 'Invalid Token', 'The approval token is invalid or has been tampered with.');
    }

    // Get the application
    let application;
    try {
      application = await getApplication(applicationId);
    } catch {
      return htmlResponse(404, 'Not Found', 'This application was not found.');
    }

    // Check if already processed (idempotent)
    if (application.status !== 'pending') {
      return htmlResponse(200, 'Already Processed', `This application has already been ${application.status}.`);
    }

    if (action === 'approve') {
      await updateApplicationStatus(applicationId, 'approved');

      // Create Discord channel for the chapter
      const discordChannel = await createChapterChannel(application.city, context);

      // Trigger GitHub Action to generate chapter page
      const appId = process.env.GITHUB_APP_ID;
      const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
      const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
      const repoOwner = process.env.GITHUB_REPO_OWNER;
      const repoName = process.env.GITHUB_REPO_NAME;

      if (!appId || !privateKey || !installationId || !repoOwner || !repoName) {
        context.log('GitHub App configuration missing — cannot trigger chapter generation');
        return htmlResponse(500, 'Configuration Error', 'Chapter approved, but page generation could not be triggered. Please contact an administrator.');
      }

      const octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId,
          privateKey,
          installationId
        }
      });

      const citySlug = application.city
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      await octokit.repos.createDispatchEvent({
        owner: repoOwner,
        repo: repoName,
        event_type: 'chapter-approved',
        client_payload: {
          application_id: applicationId,
          chapter_city: application.city,
          chapter_country: application.country,
          chapter_slug: citySlug,
          lead_name: application.fullName,
          lead_bio: application.aboutYou,
          lead_email: application.email,
          second_lead_name: application.secondLeadName || '',
          second_lead_bio: application.secondLeadAbout || '',
          second_lead_email: application.secondLeadEmail || '',
          discord_channel_id: discordChannel ? discordChannel.channelId : ''
        }
      });

      return htmlResponse(200, 'Chapter Approved ✅',
        `The chapter in <strong>${application.city}, ${application.country}</strong> has been approved!<br><br>` +
        `A chapter page is being generated and will appear on the website shortly.`
      );
    } else {
      await updateApplicationStatus(applicationId, 'rejected');
      return htmlResponse(200, 'Application Rejected',
        `The chapter application for <strong>${application.city}, ${application.country}</strong> has been rejected.`
      );
    }
  } catch (error) {
    context.log(`Error: ${error.message}`);
    return htmlResponse(500, 'Error', 'An unexpected error occurred. Please try again.');
  }
};

function htmlResponse(status, title, body) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Global Security Community</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 3rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 500px; text-align: center; }
    h1 { color: #001f3f; margin-bottom: 1rem; }
    p { color: #333; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${body}</p>
  </div>
</body>
</html>`;
  return {
    status,
    headers: { 'Content-Type': 'text/html' },
    body: html
  };
}
