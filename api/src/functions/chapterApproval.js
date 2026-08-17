const crypto = require('crypto');
const { verifyApprovalToken } = require('../helpers/tokenHelper');
const {
  getApplication,
  rejectChapterApplication,
  claimChapterPublication,
  updateChapterPublication
} = require('../helpers/tableStorage');
const { createChapterChannel, sendMessage } = require('../helpers/discordBot');
const { logAudit } = require('../helpers/auditLog');
const { stripHtml } = require('../helpers/sanitise');
const { ensureChapterBadgeTheme, ACTIVE_BADGE_THEME_YEAR } = require('../helpers/imageGenerator');
const { isImageConfigured } = require('../helpers/aiProvider');
const { Octokit } = require('@octokit/rest');
const { createAppAuth } = require('@octokit/auth-app');

function chapterSlug(city) {
  return city
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function emailHash(email) {
  return crypto.createHash('md5').update(String(email || '').trim().toLowerCase()).digest('hex');
}

function buildLeads(application) {
  const leads = [{
    name: application.fullName,
    email_hash: emailHash(application.email),
    linkedin: application.linkedIn || '',
    github: application.github || ''
  }];

  if (application.secondLeadName) {
    leads.push({
      name: application.secondLeadName,
      email_hash: emailHash(application.secondLeadEmail),
      linkedin: application.secondLeadLinkedIn || '',
      github: application.secondLeadGitHub || ''
    });
  }
  return leads;
}

function logError(context, message) {
  if (typeof context.error === 'function') context.error(message);
  else context.log(message);
}

function isRetryableGitHubError(error) {
  return error.status === 429 || error.status >= 500 || !error.status;
}

async function dispatchWithRetry(octokit, request) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await octokit.repos.createDispatchEvent(request);
      return;
    } catch (error) {
      if (attempt === 3 || !isRetryableGitHubError(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 250));
    }
  }
}

module.exports = async function (request, context) {
  context.log('Chapter approval request received');

  try {
    const url = new URL(request.url);
    const applicationId = url.searchParams.get('id');
    const action = url.searchParams.get('action');
    const token = url.searchParams.get('token');

    if (!applicationId || !action || !token) {
      return htmlResponse(400, '⚠️ Missing Parameters', 'Invalid approval link. Please use the link from Discord.');
    }

    if (action !== 'approve' && action !== 'reject') {
      return htmlResponse(400, '⚠️ Invalid Action', 'Action must be "approve" or "reject".');
    }

    // Verify the signed token
    let isValid;
    try {
      isValid = verifyApprovalToken(applicationId, action, token);
    } catch {
      return htmlResponse(403, '🔒 Invalid Token', 'The approval token is invalid or has been tampered with.');
    }

    if (!isValid) {
      return htmlResponse(403, '🔒 Invalid Token', 'The approval token is invalid or has been tampered with.');
    }

    // Get the application
    let application;
    try {
      application = await getApplication(applicationId);
    } catch {
      return htmlResponse(404, '🔍 Not Found', 'This application was not found.');
    }

    if (application.status === 'approved' && action !== 'approve') {
      return htmlResponse(200, '✅ Already Approved',
        `The chapter in <strong>${stripHtml(application.city)}, ${stripHtml(application.country)}</strong> has already been approved.`
      );
    }
    if (application.status === 'rejected') {
      return htmlResponse(200, '❌ Already Rejected',
        `The chapter application for <strong>${application.city}, ${application.country}</strong> was previously rejected.`
      );
    }

    if (action === 'reject') {
      const rejection = await rejectChapterApplication(application);
      if (!rejection.rejected) {
        return htmlResponse(200, '⚠️ Already Processed',
          'This application was processed by another approval request.'
        );
      }
      logAudit('chapter', application.city.toLowerCase().replace(/\s+/g, '-'), 'chapter_rejected', 'approval-link', { applicationId, city: application.city }, context);
      return htmlResponse(200, '❌ Application Rejected',
        `The chapter application for <strong>${application.city}, ${application.country}</strong> has been rejected.`
      );
    }

    const claim = await claimChapterPublication(application);
    if (!claim.claimed) {
      return htmlResponse(200, '✅ Approval In Progress',
        `The chapter in <strong>${stripHtml(claim.application.city)}, ${stripHtml(claim.application.country)}</strong> is already being processed.`
      );
    }
    application = claim.application;

    const citySlug = chapterSlug(application.city);
    await logAudit('chapter', citySlug, 'chapter_approved', 'approval-link', {
      applicationId,
      city: application.city,
      country: application.country,
      publicationAttempt: application.publicationAttempts
    }, context);

    // Replays reuse the persisted channel, and channel creation also looks up by name.
    var discordChannel = application.discordChannelId
      ? { channelId: application.discordChannelId, channelName: citySlug }
      : null;
    if (!discordChannel) {
      try {
        discordChannel = await createChapterChannel(application.city, context);
        if (discordChannel) {
          await updateChapterPublication(applicationId, 'dispatching', {
            discordChannelId: discordChannel.channelId
          });
        }
      } catch (err) {
        context.log(`Discord channel creation failed (non-critical): ${err.message}`);
      }
    }

    // Publication dispatch is critical: never report success if GitHub rejected it.
    try {
      const appId = process.env.GITHUB_APP_ID;
      const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
      const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
      const repoOwner = process.env.GITHUB_REPO_OWNER;
      const repoName = process.env.GITHUB_REPO_NAME;

      if (!appId || !privateKey || !installationId || !repoOwner || !repoName) {
        throw new Error('GitHub App configuration is incomplete');
      }

      const octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: { appId, privateKey, installationId }
      });

      await dispatchWithRetry(octokit, {
        owner: repoOwner,
        repo: repoName,
        event_type: 'chapter-approved',
        client_payload: {
          application_id: applicationId,
          chapter_city: application.city,
          chapter_country: application.country,
          chapter_slug: citySlug,
          leads: JSON.stringify(buildLeads(application)),
          discord_channel_id: discordChannel ? discordChannel.channelId : '',
          notification_channel_id: process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID || ''
        }
      });

      await updateChapterPublication(applicationId, 'queued', {
        publicationError: '',
        publicationDispatchedAt: new Date().toISOString()
      });
      await logAudit('chapter', citySlug, 'chapter_publication_queued', 'approval-link', {
        applicationId,
        publicationAttempt: application.publicationAttempts
      }, context);
    } catch (err) {
      const errorMessage = String(err.message || 'Unknown GitHub dispatch error').slice(0, 500);
      await updateChapterPublication(applicationId, 'failed', {
        publicationError: errorMessage
      });
      await logAudit('chapter', citySlug, 'chapter_publication_failed', 'approval-link', {
        applicationId,
        error: errorMessage,
        publicationAttempt: application.publicationAttempts
      }, context);
      logError(context, `Chapter publication dispatch failed for ${applicationId}: ${errorMessage}`);

      const notificationChannelId = process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID;
      if (notificationChannelId) {
        await sendMessage(notificationChannelId, {
          embeds: [{
            title: 'Chapter publication failed',
            description: `The approved **${stripHtml(application.city)}** chapter could not be queued for publication.`,
            color: 0xcc3333,
            footer: { text: `Application ${applicationId}` }
          }]
        }, context);
      }

      return htmlResponse(502, '❌ Publication Failed',
        'The chapter was approved, but publication could not be started. The failure has been logged and this approval link can be used to retry safely.'
      );
    }

    // Artwork is non-critical and starts only after the page publication is safely queued.
    if (isImageConfigured()) {
      try {
        await ensureChapterBadgeTheme(
          ACTIVE_BADGE_THEME_YEAR,
          citySlug,
          application.city,
          application.country,
          context
        );
      } catch (imgErr) {
        context.log(`Chapter artwork generation failed (non-critical): ${imgErr.message}`);
      }
    }

    return htmlResponse(202, '✅ Chapter Approved',
      `The chapter in <strong>${stripHtml(application.city)}, ${stripHtml(application.country)}</strong> has been approved. Its page is being tested and will be published automatically.`
    );

  } catch (error) {
    context.log(`Error: ${error.message}`);
    return htmlResponse(500, '❌ Error', 'An unexpected error occurred processing this approval. Please try clicking the link again.');
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
    .card { background: white; padding: 2.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 500px; text-align: center; }
    .logo { height: 60px; margin-bottom: 1rem; }
    h1 { color: #001f3f; margin-bottom: 1rem; font-size: 1.5rem; }
    p { color: #333; line-height: 1.8; }
    .back-link { display: inline-block; margin-top: 1.5rem; color: #20b2aa; text-decoration: none; font-weight: 500; }
    .back-link:hover { color: #001f3f; }
  </style>
</head>
<body>
  <div class="card">
    <img src="https://globalsecurity.community/assets/GlobalSecurityCommunityLogo2.png" alt="GSC" class="logo">
    <h1>${title}</h1>
    <p>${body}</p>
    <a href="https://globalsecurity.community" class="back-link">← Back to website</a>
  </div>
</body>
</html>`;
  return {
    status,
    headers: { 'Content-Type': 'text/html' },
    body: html
  };
}
