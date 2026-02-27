const { getEventBySlug, countRegistrations } = require('../helpers/tableStorage');

/**
 * GET /api/getEvent?slug={slug}
 * Public endpoint — returns event details + registration count.
 */
module.exports = async function (request, context) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');

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
        status: event.status
      })
    };
  } catch (error) {
    context.log(`getEvent error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
