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

    const { title, date, endDate, description, sessionizeApiId, registrationCap, chapterSlug,
            locationBuilding, locationAddress1, locationAddress2, locationCity, locationState,
            location: legacyLocation } = body;

    if (!title || !date || !description || !chapterSlug) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing required fields: title, date, description, chapterSlug' }) };
    }

    // Accept structured address OR legacy single location field
    if (!locationAddress1 && !legacyLocation) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing required field: address' }) };
    }

    // Sanitise user inputs
    const safe = sanitiseFields(
      { title, description,
        locationBuilding: locationBuilding || '',
        locationAddress1: locationAddress1 || '',
        locationAddress2: locationAddress2 || '',
        locationCity: locationCity || '',
        locationState: locationState || '',
        legacyLocation: legacyLocation || '' },
      ['title', 'description', 'locationBuilding', 'locationAddress1', 'locationAddress2', 'locationCity', 'locationState', 'legacyLocation']
    );

    // Compose display location from structured fields or use legacy
    let location;
    if (locationAddress1) {
      const parts = [safe.locationBuilding, safe.locationAddress1, safe.locationAddress2].filter(Boolean);
      const cityState = [safe.locationCity, safe.locationState].filter(Boolean).join(' ');
      if (cityState) parts.push(cityState);
      location = parts.join('\n');
    } else {
      location = safe.legacyLocation;
    }

    if (safe.title.length > 200 || location.length > 500 || safe.description.length > 5000) {
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
      chapterSlug: chapterSlug.toLowerCase().trim(),
      date,
      endDate: endDate || '',
      location,
      locationBuilding: safe.locationBuilding,
      locationAddress1: safe.locationAddress1,
      locationAddress2: safe.locationAddress2,
      locationCity: safe.locationCity,
      locationState: safe.locationState,
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
