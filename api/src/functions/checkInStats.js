const {
  getAuthUser,
  hasRole,
  unauthorised,
  forbidden,
  verifyEventCheckInAccess
} = require('../helpers/auth');
const { getEventById, getRegistrationsByEvent } = require('../helpers/tableStorage');

/**
 * GET /api/checkInStats?eventId={eventId}
 * Returns privacy-safe scanner totals to authorised organisers and volunteers.
 */
module.exports = async function (request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin') && !hasRole(user, 'volunteer')) {
      return forbidden('Only event organisers and volunteers can view check-in totals');
    }

    const eventId = new URL(request.url).searchParams.get('eventId')?.trim() || '';
    if (!eventId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing eventId parameter' }
      };
    }

    const event = await getEventById(eventId);
    if (!event) {
      return {
        status: 400,
        jsonBody: { error: 'Event not found' }
      };
    }

    const chapterSlug = event.chapterSlug || event.partitionKey || '';
    if (!await verifyEventCheckInAccess(user, eventId, chapterSlug, context)) {
      return forbidden('You do not have permission to view check-in totals for this event');
    }

    const registrations = await getRegistrationsByEvent(eventId);
    const checkedIn = registrations.filter(registration =>
      registration.checkedIn === true || registration.checkedIn === 'true'
    ).length;

    return {
      status: 200,
      jsonBody: { total: registrations.length, checkedIn }
    };
  } catch (error) {
    context.log(`checkInStats error: ${error.message}`);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' }
    };
  }
};
