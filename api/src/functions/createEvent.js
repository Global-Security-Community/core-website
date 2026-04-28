const { randomUUID } = require('crypto');
const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { storeEvent, getSubscriptionsByChapter, updateEvent, getApprovedApplicationBySlug, getEventBySlug } = require('../helpers/tableStorage');
const { sanitiseFields, sanitiseRichText, stripHtml } = require('../helpers/sanitise');
const { sendMessage } = require('../helpers/discordBot');
const { sendEventNotificationEmail } = require('../helpers/emailService');
const { logAudit } = require('../helpers/auditLog');
// AI image generation disabled until reliable workflow is established
// const { generateEventBadgeBackground } = require('../helpers/imageGenerator');
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

    // Verify admin has access to this chapter
    if (!await verifyChapterAccess(user, chapterSlug, context)) {
      return forbidden('You do not have permission to create events for this chapter');
    }

    // Accept structured address OR legacy single location field
    if (!locationAddress1 && !legacyLocation) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing required field: address' }) };
    }

    // Validate that the chapter slug corresponds to an existing approved chapter
    const chapter = await getApprovedApplicationBySlug(chapterSlug.toLowerCase().trim());
    if (!chapter) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Invalid chapter slug: no approved chapter found' }) };
    }

    // Sanitise user inputs
    const safe = sanitiseFields(
      { title,
        locationBuilding: locationBuilding || '',
        locationAddress1: locationAddress1 || '',
        locationAddress2: locationAddress2 || '',
        locationCity: locationCity || '',
        locationState: locationState || '',
        legacyLocation: legacyLocation || '' },
      ['title', 'locationBuilding', 'locationAddress1', 'locationAddress2', 'locationCity', 'locationState', 'legacyLocation']
    );
    const safeDescription = sanitiseRichText(description);

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

    if (safe.title.length > 200 || location.length > 500 || safeDescription.length > 10000) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Field length exceeds maximum' }) };
    }

    const eventId = randomUUID();
    let slug = safe.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 80);

    // Ensure slug uniqueness — append city or counter if needed
    if (await getEventBySlug(slug)) {
      const citySlug = (safe.locationCity || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (citySlug && !slug.includes(citySlug)) {
        slug = (slug + '-' + citySlug).substring(0, 80);
      }
      // If still not unique, append a counter
      let counter = 2;
      let candidate = slug;
      while (await getEventBySlug(candidate)) {
        candidate = slug + '-' + counter;
        counter++;
      }
      slug = candidate;
    }

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
      description: safeDescription,
      sessionizeApiId: sessionizeApiId || '',
      registrationCap: parseInt(registrationCap) || 0,
      status: 'draft',
      createdBy: user.userId
    };

    await storeEvent(event);

    // AI image generation disabled until reliable workflow is established
    // To re-enable: uncomment the imageGenerator import and the block below
    // try {
    //   const city = safe.locationCity || safe.legacyLocation || '';
    //   const badgeImageUrl = await generateEventBadgeBackground(safe.title, city, slug, context);
    //   if (badgeImageUrl) {
    //     await updateEvent(chapterSlug.toLowerCase().trim(), eventId, { badgeImageUrl });
    //     context.log(`Badge background generated: ${badgeImageUrl}`);
    //   }
    // } catch (imgErr) {
    //   context.log(`Badge background generation failed (non-critical): ${imgErr.message}`);
    // }

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
            event_location: location,
            event_description: stripHtml(safeDescription),
            event_sessionize_id: sessionizeApiId || '',
            event_registration_cap: (parseInt(registrationCap) || 0).toString(),
            chapter_slug: chapterSlug.toLowerCase().trim()
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
        const sent = await sendMessage(notifChannel, {
          embeds: [{
            title: '📅 New Event Created',
            color: 0xffa500,
            fields: [
              { name: 'Event', value: safe.title, inline: true },
              { name: 'Date', value: date, inline: true },
              { name: 'Location', value: location, inline: true },
              { name: 'Chapter', value: chapterSlug, inline: true }
            ],
            timestamp: new Date().toISOString()
          }]
        }, context);
        if (!sent) context.log('Discord event notification was not delivered');
      } catch (discErr) {
        context.log(`Discord notification failed: ${discErr.message}`);
      }
    }

    // Notify chapter subscribers (non-blocking)
    try {
      const subscribers = await getSubscriptionsByChapter(chapterSlug.toLowerCase().trim());
      if (subscribers.length > 0) {
        context.log(`Sending event notifications to ${subscribers.length} chapter subscribers`);
        for (const sub of subscribers) {
          try {
            await sendEventNotificationEmail(sub.email, event, context);
          } catch (emailErr) {
            context.log(`Notification to ${sub.email} failed: ${emailErr.message}`);
          }
        }
      }
    } catch (notifErr) {
      context.log(`Chapter notification failed (non-critical): ${notifErr.message}`);
    }

    logAudit('event', eventId, 'event_created', user.userDetails, { chapterSlug: chapterSlug.toLowerCase().trim(), title: safe.title, slug, date }, context);

    return {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, event: { id: eventId, slug, title: safe.title, chapterSlug: chapterSlug.toLowerCase().trim() } })
    };
  } catch (error) {
    context.log(`createEvent error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
