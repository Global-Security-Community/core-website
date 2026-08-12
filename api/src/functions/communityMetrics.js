const { listEvents, countRegistrationsForEvents } = require('../helpers/tableStorage');

const PUBLIC_EVENT_STATUSES = new Set(['published', 'closed', 'completed']);

/**
 * GET /api/communityMetrics
 * Returns public aggregate community activity without exposing registration data.
 */
module.exports = async function communityMetrics(request, context) {
  try {
    const events = await listEvents();
    const publishedEventIds = events
      .filter(event => PUBLIC_EVENT_STATUSES.has(event.status))
      .map(event => event.rowKey);
    const totalRegistrations = await countRegistrationsForEvents(publishedEventIds);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600'
      },
      jsonBody: {
        eventsHosted: publishedEventIds.length,
        totalRegistrations
      }
    };
  } catch (error) {
    context.log(`communityMetrics error: ${error.message}`);
    return {
      status: 500,
      jsonBody: { error: 'Unable to load community metrics' }
    };
  }
};
