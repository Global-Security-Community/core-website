const { verifyApprovalToken } = require('../helpers/tokenHelper');
const { getApplication, updateApplicationStatus } = require('../helpers/tableStorage');
const { createChapterChannel } = require('../helpers/discordBot');
// AI image generation disabled for now — use dashboard to regenerate when ready
// const { generateChapterBanner, generateChapterShield } = require('../helpers/imageGenerator');
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

    // Check if already processed — show friendly message
    if (application.status === 'approved') {
      return htmlResponse(200, '✅ Already Approved',
        `The chapter in <strong>${application.city}, ${application.country}</strong> has already been approved.<br><br>No further action needed.`
      );
    }
    if (application.status === 'rejected') {
      return htmlResponse(200, '❌ Already Rejected',
        `The chapter application for <strong>${application.city}, ${application.country}</strong> was previously rejected.`
      );
    }

    if (action === 'reject') {
      await updateApplicationStatus(applicationId, 'rejected');
      return htmlResponse(200, '❌ Application Rejected',
        `The chapter application for <strong>${application.city}, ${application.country}</strong> has been rejected.`
      );
    }

    // --- Approve flow: run side effects BEFORE updating status ---

    // 1. Create Discord channel (non-critical — continue if it fails)
    var discordChannel = null;
    try {
      discordChannel = await createChapterChannel(application.city, context);
    } catch (err) {
      context.log(`Discord channel creation failed (non-critical): ${err.message}`);
    }

    // 2. Trigger GitHub Action to generate chapter page (non-critical)
    var pageTriggered = false;
    try {
      const appId = process.env.GITHUB_APP_ID;
      const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
      const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
      const repoOwner = process.env.GITHUB_REPO_OWNER;
      const repoName = process.env.GITHUB_REPO_NAME;

      if (appId && privateKey && installationId && repoOwner && repoName) {
        const octokit = new Octokit({
          authStrategy: createAppAuth,
          auth: { appId, privateKey, installationId }
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
            lead_email: application.email,
            lead_linkedin: application.linkedIn || '',
            lead_github: application.github || '',
            second_lead: JSON.stringify({
              name: application.secondLeadName || '',
              email: application.secondLeadEmail || '',
              linkedin: application.secondLeadLinkedIn || '',
              github: application.secondLeadGitHub || ''
            }),
            discord_channel_id: discordChannel ? discordChannel.channelId : ''
          }
        });
        pageTriggered = true;
      } else {
        context.log('GitHub App configuration missing — chapter page generation skipped');
      }
    } catch (err) {
      context.log(`GitHub dispatch failed (non-critical): ${err.message}`);
    }

    // 3. AI image generation disabled — use dashboard "Regenerate" to create shield/banner
    // To re-enable: uncomment the imageGenerator import and the block below
    // try {
    //   const { TableClient } = require('@azure/data-tables');
    //   const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    //   const client = TableClient.fromConnectionString(connStr, 'ChapterApplications');
    //   const shieldUrl = await generateChapterShield(application.city, application.country, context);
    //   if (shieldUrl) {
    //     await client.updateEntity({ partitionKey: application.partitionKey || 'chapter', rowKey: application.rowKey || applicationId, shieldImageUrl: shieldUrl }, 'Merge');
    //   }
    // } catch (imgErr) {
    //   context.log(`Image generation failed (non-critical): ${imgErr.message}`);
    // }

    // 4. Update status to approved (this is the critical step)
    await updateApplicationStatus(applicationId, 'approved');

    // Build success message with details about what happened
    var details = [`The chapter in <strong>${application.city}, ${application.country}</strong> has been approved!`];
    if (discordChannel) {
      details.push('✅ Discord channel created');
    } else {
      details.push('⚠️ Discord channel could not be created — set up manually');
    }
    if (pageTriggered) {
      details.push('✅ Chapter page generation triggered');
    } else {
      details.push('⚠️ Chapter page could not be auto-generated — create manually');
    }
    details.push('ℹ️ Use the dashboard to generate chapter shield and banner images');

    return htmlResponse(200, '✅ Chapter Approved',
      details.join('<br>'));

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
