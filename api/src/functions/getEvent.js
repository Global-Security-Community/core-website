const { getEventBySlug, countRegistrations, listEvents, getRegistrationsByRole } = require('../helpers/tableStorage');

/**
 * GET /api/getEvent?slug={slug}       — returns a single event
 * GET /api/getEvent?action=list       — returns all published events
 * GET /api/getEvent?action=list&chapter={slug} — returns published events for a chapter
 * Public endpoint.
 */
module.exports = async function (request, context) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const slug = url.searchParams.get('slug');
    const chapterSlug = url.searchParams.get('chapter');

    if (action === 'list') {
      // Fetch all events — filter by chapter case-insensitively in code
      const events = await listEvents();
      const lowerChapter = chapterSlug ? chapterSlug.toLowerCase() : null;
      const includeStatuses = ['published', 'closed', 'completed'];
      const published = events
        .filter(e => includeStatuses.includes(e.status))
        .filter(e => !lowerChapter || (e.partitionKey || '').toLowerCase() === lowerChapter)
        .map(e => ({
          id: e.rowKey,
          title: e.title,
          slug: e.slug,
          chapterSlug: e.partitionKey,
          date: e.date,
          endDate: e.endDate || '',
          location: e.location,
          description: e.description,
          registrationCap: e.registrationCap || 0,
          status: e.status
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(published)
      };
    }

    if (!slug) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing slug parameter' }) };
    }

    const event = await getEventBySlug(slug);
    if (!event) {
      return { status: 404, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Event not found' }) };
    }

    const registrationCount = await countRegistrations(event.rowKey);

    // Fetch volunteers (public-safe info only)
    let volunteers = [];
    try {
      const volRegs = await getRegistrationsByRole(event.rowKey, 'volunteer');
      volunteers = volRegs.map(v => ({
        name: v.fullName,
        company: v.company || ''
      }));
    } catch { /* non-critical */ }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: event.rowKey,
        title: event.title,
        slug: event.slug,
        chapterSlug: event.chapterSlug,
        date: event.date,
        endDate: event.endDate || '',
        location: event.location,
        description: event.description,
        sessionizeApiId: event.sessionizeApiId || '',
        registrationCap: event.registrationCap || 0,
        registrationCount,
        status: event.status,
        volunteers
      })
    };
  } catch (error) {
    context.log(`getEvent error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
