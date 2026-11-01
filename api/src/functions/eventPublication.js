const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess, verifyCsrfHeader } = require('../helpers/auth');
const { getEvent } = require('../helpers/tableStorage');
const { eventPublicationResponse, queueEventPublication } = require('../helpers/eventPublication');

/**
 * GET /api/eventPublication?eventId={id}&chapterSlug={slug} — publication progress.
 * POST /api/eventPublication — safely queue or retry a saved event's publication.
 */
async function eventPublication(request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only chapter leads can manage event publication');
    const csrfError = verifyCsrfHeader(request);
    if (csrfError) return csrfError;

    let parameters;
    if (request.method === 'GET') {
      const url = new URL(request.url);
      parameters = {
        eventId: url.searchParams.get('eventId'),
        chapterSlug: url.searchParams.get('chapterSlug')
      };
    } else {
      try { parameters = await request.json(); } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON' } };
      }
    }
    if (!parameters || typeof parameters !== 'object') {
      return { status: 400, jsonBody: { error: 'Invalid publication request' } };
    }
    const { eventId, chapterSlug } = parameters;
    if (typeof eventId !== 'string' || !eventId || eventId.length > 128 ||
        typeof chapterSlug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,60}[a-z0-9]$/.test(chapterSlug)) {
      return { status: 400, jsonBody: { error: 'Invalid eventId or chapterSlug' } };
    }
    if (!await verifyChapterAccess(user, chapterSlug, context)) {
      return forbidden('You do not have permission to manage this chapter');
    }

    const event = await getEvent(chapterSlug, eventId);
    if (!event) return { status: 400, jsonBody: { error: 'Event not found' } };
    if (request.method === 'GET') {
      return { status: 200, jsonBody: { event: eventPublicationResponse(event) } };
    }
    if (['closed', 'completed'].includes(event.status)) {
      return { status: 409, jsonBody: { error: 'Closed or completed events cannot be queued for publication' } };
    }

    const result = await queueEventPublication(chapterSlug, eventId, user.userDetails, context);
    return {
      status: result.error ? 502 : result.queued ? 202 : 200,
      jsonBody: {
        ...(result.error ? { error: 'The event is saved, but publication could not be started. Retry publication after checking the reported error.' } : {}),
        event: eventPublicationResponse(result.event)
      }
    };
  } catch (error) {
    context.log(`eventPublication error: ${error.message}`);
    return {
      status: error.statusCode === 404 ? 400 : 500,
      jsonBody: { error: error.statusCode === 404 ? 'Event not found' : 'Could not read or queue event publication' }
    };
  }
}

module.exports = eventPublication;
