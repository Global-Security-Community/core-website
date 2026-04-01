const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { storeSessionizeCache, getEventById } = require('../helpers/tableStorage');

/**
 * POST /api/refreshSessionize
 * Admin-only: fetch speakers and agenda from Sessionize API and cache locally.
 */
module.exports = async function (request, context) {
  context.log('Refresh Sessionize data request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only event organisers can refresh Sessionize data');

    let body;
    try { body = await request.json(); } catch {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { eventId, chapterSlug, sessionizeApiId } = body;

    if (!sessionizeApiId) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing sessionizeApiId' }) };
    }

    // Verify admin has access to this event's chapter
    if (eventId) {
      const event = await getEventById(eventId);
      if (event) {
        const evChapterSlug = event.chapterSlug || event.partitionKey || '';
        if (!await verifyChapterAccess(user, evChapterSlug, context)) {
          return forbidden('You do not have permission to refresh data for this event');
        }
      }
    } else if (chapterSlug) {
      if (!await verifyChapterAccess(user, chapterSlug, context)) {
        return forbidden('You do not have permission to manage this chapter');
      }
    }

    // Fetch speakers from Sessionize
    let speakers = [];
    try {
      const speakersRes = await fetch(`https://sessionize.com/api/v2/${encodeURIComponent(sessionizeApiId)}/view/Speakers`);
      if (speakersRes.ok) {
        speakers = await speakersRes.json();
      } else {
        context.log(`Sessionize speakers fetch failed: ${speakersRes.status}`);
      }
    } catch (err) {
      context.log(`Sessionize speakers fetch error: ${err.message}`);
    }

    // Fetch agenda from Sessionize
    let agenda = [];
    try {
      const agendaRes = await fetch(`https://sessionize.com/api/v2/${encodeURIComponent(sessionizeApiId)}/view/GridSmart`);
      if (agendaRes.ok) {
        agenda = await agendaRes.json();
      } else {
        context.log(`Sessionize agenda fetch failed: ${agendaRes.status}`);
      }
    } catch (err) {
      context.log(`Sessionize agenda fetch error: ${err.message}`);
    }

    if (speakers.length === 0 && agenda.length === 0) {
      return { status: 200, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ success: true, speakers: 0, agenda: 0, message: 'No data returned from Sessionize. Check the API ID.' }) };
    }

    // Cache both in Table Storage
    const now = new Date().toISOString();
    if (speakers.length > 0) {
      await storeSessionizeCache(sessionizeApiId, 'speakers', speakers);
    }
    if (agenda.length > 0) {
      await storeSessionizeCache(sessionizeApiId, 'agenda', agenda);
    }

    context.log(`Cached ${speakers.length} speakers and ${agenda.length} agenda items for ${sessionizeApiId}`);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        speakers: speakers.length,
        agenda: agenda.length,
        lastRefreshed: now,
        speakerNames: speakers.map(s => s.fullName)
      })
    };
  } catch (error) {
    context.log(`refreshSessionize error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
