const crypto = require('crypto');
const { getAuthUser, hasRole, unauthorised, forbidden } = require('../helpers/auth');
const { getApprovedApplicationBySlug, updateApplicationStatus } = require('../helpers/tableStorage');
const { stripHtml } = require('../helpers/sanitise');
const { Octokit } = require('@octokit/rest');
const { createAppAuth } = require('@octokit/auth-app');

const MAX_LEADS = 4;

/**
 * POST /api/updateChapter
 * Admin-only: update chapter leads and social links, regenerate the chapter page.
 */
module.exports = async function (request, context) {
  context.log('Update chapter request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only chapter leads can edit chapter details');

    let body;
    try { body = await request.json(); } catch {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { chapterSlug, leads } = body;

    if (!chapterSlug || !leads || !Array.isArray(leads) || leads.length === 0) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing chapterSlug or leads array' }) };
    }

    if (leads.length > MAX_LEADS) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: `Maximum ${MAX_LEADS} leads allowed` }) };
    }

    // Validate each lead
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      if (!lead.name || !lead.email) {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: `Lead ${i + 1}: name and email are required` }) };
      }
    }

    // Find the approved application for this chapter
    const application = await getApprovedApplicationBySlug(chapterSlug);
    if (!application) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'No approved chapter found for this slug' }) };
    }

    // Sanitise and build lead data
    const sanitisedLeads = leads.map(lead => ({
      name: stripHtml(lead.name).trim(),
      email: stripHtml(lead.email).trim().toLowerCase(),
      github: stripHtml(lead.github || '').trim(),
      linkedin: stripHtml(lead.linkedin || '').trim(),
      twitter: stripHtml(lead.twitter || '').trim(),
      website: stripHtml(lead.website || '').trim()
    }));

    // Update the application record with leads JSON
    const { TableClient } = require('@azure/data-tables');
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
    const client = TableClient.fromConnectionString(connectionString, 'ChapterApplications');
    await client.updateEntity({
      partitionKey: 'applications',
      rowKey: application.rowKey,
      leadsJson: JSON.stringify(sanitisedLeads),
      updatedAt: new Date().toISOString()
    }, 'Merge');

    // Regenerate the chapter markdown page via GitHub Contents API
    let pageUpdated = false;
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

        const filePath = `src/chapters/${chapterSlug}/index.md`;

        // Get current file SHA (needed for update)
        let sha = '';
        try {
          const { data } = await octokit.repos.getContent({
            owner: repoOwner, repo: repoName, path: filePath, ref: 'main'
          });
          sha = data.sha;
        } catch (err) {
          context.log(`Could not get existing file SHA: ${err.message}`);
        }

        // Build new markdown content
        const markdown = buildChapterMarkdown({
          city: application.city,
          country: application.country,
          discordChannelId: application.discordChannelId || '',
          discordGuildId: application.discordGuildId || '',
          leads: sanitisedLeads
        });

        const params = {
          owner: repoOwner,
          repo: repoName,
          path: filePath,
          message: `Update chapter page for ${application.city}\n\nUpdated by ${user.userDetails} via dashboard.\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`,
          content: Buffer.from(markdown).toString('base64'),
          branch: 'main'
        };
        if (sha) params.sha = sha;

        await octokit.repos.createOrUpdateFileContents(params);
        pageUpdated = true;
        context.log(`Chapter page updated for ${chapterSlug}`);
      } else {
        context.log('GitHub App configuration missing — page update skipped');
      }
    } catch (err) {
      context.log(`GitHub page update failed: ${err.message}`);
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        leads: sanitisedLeads.map(l => ({ name: l.name, email: l.email })),
        pageUpdated
      })
    };
  } catch (error) {
    context.log(`updateChapter error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

function buildChapterMarkdown({ city, country, discordChannelId, discordGuildId, leads }) {
  let yaml = '---\n';
  yaml += 'layout: chapter.njk\n';
  yaml += `title: "Global Security Community ${city}"\n`;
  yaml += `city: "${city}"\n`;
  yaml += `country: "${country}"\n`;
  yaml += 'tags: chapter\n';
  yaml += `discord_channel_id: "${discordChannelId}"\n`;
  yaml += `discord_guild_id: "${discordGuildId}"\n`;
  yaml += 'leads:\n';

  for (const lead of leads) {
    const emailHash = crypto.createHash('md5').update(lead.email.toLowerCase().trim()).digest('hex');
    yaml += `  - name: "${lead.name}"\n`;
    yaml += `    email_hash: "${emailHash}"\n`;
    if (lead.github) yaml += `    github: "${lead.github}"\n`;
    if (lead.linkedin) yaml += `    linkedin: "${lead.linkedin}"\n`;
    if (lead.twitter) yaml += `    twitter: "${lead.twitter}"\n`;
    if (lead.website) yaml += `    website: "${lead.website}"\n`;
  }

  yaml += '---\n';
  return yaml;
}
