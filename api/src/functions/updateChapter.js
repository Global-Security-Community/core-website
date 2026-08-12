const crypto = require('crypto');
const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { getApprovedApplicationBySlug, updateApplicationStatus } = require('../helpers/tableStorage');
const { stripHtml, sanitiseUrl } = require('../helpers/sanitise');
const { Octokit } = require('@octokit/rest');
const { createAppAuth } = require('@octokit/auth-app');
const { logAudit } = require('../helpers/auditLog');

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

    // Verify admin has access to this chapter
    if (!await verifyChapterAccess(user, chapterSlug, context)) {
      return forbidden('You do not have permission to edit this chapter');
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
      github: sanitiseUrl(lead.github || ''),
      linkedin: sanitiseUrl(lead.linkedin || ''),
      twitter: sanitiseUrl(lead.twitter || ''),
      website: sanitiseUrl(lead.website || '')
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

    // Queue an automated PR because main is protected from direct writes.
    let pageUpdateQueued = false;
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
        let existingLatitude = '';
        let existingLongitude = '';
        try {
          const { data } = await octokit.repos.getContent({
            owner: repoOwner, repo: repoName, path: filePath, ref: 'main'
          });
          const fileContent = Buffer.from(data.content, 'base64').toString('utf8');
          const latMatch = fileContent.match(/^latitude:\s*(-?[\d.]+)/m);
          const lngMatch = fileContent.match(/^longitude:\s*(-?[\d.]+)/m);
          if (latMatch) existingLatitude = latMatch[1];
          if (lngMatch) existingLongitude = lngMatch[1];
        } catch (err) {
          context.log(`Could not get existing file SHA: ${err.message}`);
        }

        // Build new markdown content
        const markdown = buildChapterMarkdown({
          city: application.city,
          country: application.country,
          discordChannelId: application.discordChannelId || '',
          discordGuildId: application.discordGuildId || '',
          leads: sanitisedLeads,
          latitude: existingLatitude,
          longitude: existingLongitude
        });

        await octokit.repos.createDispatchEvent({
          owner: repoOwner,
          repo: repoName,
          event_type: 'chapter-updated',
          client_payload: {
            chapter_slug: chapterSlug,
            chapter_city: application.city,
            chapter_markdown_base64: Buffer.from(markdown).toString('base64')
          }
        });
        pageUpdateQueued = true;
        context.log(`Chapter page update queued for ${chapterSlug}`);
      } else {
        context.log('GitHub App configuration missing — page update PR skipped');
      }
    } catch (err) {
      context.log(`GitHub page update dispatch failed: ${err.message}`);
    }

    logAudit('chapter', chapterSlug, 'chapter_updated', user.userDetails, {
      leadCount: sanitisedLeads.length,
      pageUpdateQueued
    }, context);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        leads: sanitisedLeads.map(l => ({ name: l.name, email: l.email })),
        pageUpdated: pageUpdateQueued,
        pageUpdateQueued
      })
    };
  } catch (error) {
    context.log(`updateChapter error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

/**
 * Escapes a string for safe use inside double-quoted YAML values.
 * Handles: backslash, double quote, newlines, tabs.
 */
function escapeYamlString(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function buildChapterMarkdown({ city, country, discordChannelId, discordGuildId, leads, latitude, longitude }) {
  let yaml = '---\n';
  yaml += 'layout: chapter.njk\n';
  yaml += `title: "${escapeYamlString('Global Security Community ' + city)}"\n`;
  yaml += `city: "${escapeYamlString(city)}"\n`;
  yaml += `country: "${escapeYamlString(country)}"\n`;
  if (latitude && longitude) {
    yaml += `latitude: ${latitude}\n`;
    yaml += `longitude: ${longitude}\n`;
  }
  yaml += 'tags: chapter\n';
  yaml += `discord_channel_id: "${escapeYamlString(discordChannelId)}"\n`;
  yaml += `discord_guild_id: "${escapeYamlString(discordGuildId)}"\n`;
  yaml += 'leads:\n';

  for (const lead of leads) {
    const emailHash = crypto.createHash('md5').update(lead.email.toLowerCase().trim()).digest('hex');
    yaml += `  - name: "${escapeYamlString(lead.name)}"\n`;
    yaml += `    email_hash: "${emailHash}"\n`;
    if (lead.github) yaml += `    github: "${escapeYamlString(lead.github)}"\n`;
    if (lead.linkedin) yaml += `    linkedin: "${escapeYamlString(lead.linkedin)}"\n`;
    if (lead.twitter) yaml += `    twitter: "${escapeYamlString(lead.twitter)}"\n`;
    if (lead.website) yaml += `    website: "${escapeYamlString(lead.website)}"\n`;
  }

  yaml += '---\n';
  return yaml;
}
