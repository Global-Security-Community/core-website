const { randomUUID } = require('crypto');
const { getAuthUser, hasRole, unauthorised, forbidden } = require('../helpers/auth');
const { storeEvent, listEvents } = require('../helpers/tableStorage');
const { sanitiseFields } = require('../helpers/sanitise');
const { sendMessage } = require('../helpers/discordBot');
const { Octokit } = require('@octokit/rest');
const { createAppAuth } = require('@octokit/auth-app');

module.exports = async function (request, context) {
  context.log('Create event request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only chapter leads can create events');

    let body;
    try { body = await request.json(); } catch {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { title, date, endDate, location, description, sessionizeApiId, registrationCap, chapterSlug } = body;

    if (!title || !date || !location || !description || !chapterSlug) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing required fields: title, date, location, description, chapterSlug' }) };
    }

    // Sanitise user inputs
    const safe = sanitiseFields(
      { title, location, description },
      ['title', 'location', 'description']
    );

    if (safe.title.length > 200 || safe.location.length > 300 || safe.description.length > 5000) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Field length exceeds maximum' }) };
    }

    const eventId = randomUUID();
    const slug = safe.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 80);

    const event = {
      id: eventId,
      title: safe.title,
      slug,
      chapterSlug,
      date,
      endDate: endDate || '',
      location: safe.location,
      description: safe.description,
      sessionizeApiId: sessionizeApiId || '',
      registrationCap: parseInt(registrationCap) || 0,
      status: 'published',
      createdBy: user.userId
    };

    await storeEvent(event);

    // Trigger GitHub Action to generate event page
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
    const repoOwner = process.env.GITHUB_REPO_OWNER;
    const repoName = process.env.GITHUB_REPO_NAME;

    if (appId && privateKey && installationId && repoOwner && repoName) {
      try {
        const octokit = new Octokit({
          authStrategy: createAppAuth,
          auth: { appId, privateKey, installationId }
        });

        await octokit.repos.createDispatchEvent({
          owner: repoOwner,
          repo: repoName,
          event_type: 'event-created',
          client_payload: {
            event_id: eventId,
            event_title: safe.title,
            event_slug: slug,
            event_date: date,
            event_end_date: endDate || '',
            event_location: safe.location,
            event_description: safe.description,
            event_sessionize_id: sessionizeApiId || '',
            event_registration_cap: (parseInt(registrationCap) || 0).toString(),
            chapter_slug: chapterSlug
          }
        });
        context.log(`GitHub dispatch sent for event ${slug}`);
      } catch (ghErr) {
        context.log(`GitHub dispatch failed: ${ghErr.message}`);
      }
    }

    // Notify Discord
    const notifChannel = process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID;
    if (notifChannel) {
      try {
        await sendMessage(notifChannel, {
          embeds: [{
            title: '📅 New Event Created',
            color: 0xffa500,
            fields: [
              { name: 'Event', value: safe.title, inline: true },
              { name: 'Date', value: date, inline: true },
              { name: 'Location', value: safe.location, inline: true },
              { name: 'Chapter', value: chapterSlug, inline: true }
            ],
            timestamp: new Date().toISOString()
          }]
        }, context);
      } catch (discErr) {
        context.log(`Discord notification failed: ${discErr.message}`);
      }
    }

    return {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, event: { id: eventId, slug, title: safe.title } })
    };
  } catch (error) {
    context.log(`createEvent error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
