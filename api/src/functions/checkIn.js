const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { getRegistrationByTicketCode, updateRegistration, getEventById } = require('../helpers/tableStorage');
const { logAudit } = require('../helpers/auditLog');

/**
 * POST /api/checkIn
 * Admin-only: check in an attendee by scanning their ticket QR code.
 */
module.exports = async function (request, context) {
  context.log('Check-in request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin') && !hasRole(user, 'volunteer')) return forbidden('Only event organisers and volunteers can check in attendees');

    let body;
    try { body = await request.json(); } catch {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { ticketCode, eventId } = body;
    if (!ticketCode || !eventId) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing ticketCode or eventId' }) };
    }

    // Verify admin/volunteer has access to this event's chapter
    const event = await getEventById(eventId);
    if (event) {
      const chapterSlug = event.chapterSlug || event.partitionKey || '';
      if (!await verifyChapterAccess(user, chapterSlug, context)) {
        return forbidden('You do not have permission to check in attendees for this event');
      }
    }

    const registration = await getRegistrationByTicketCode(eventId, ticketCode);
    if (!registration) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid ticket', status: 'invalid' })
      };
    }

    if (registration.checkedIn) {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'already_checked_in',
          attendeeName: registration.fullName,
          checkedInAt: registration.checkedInAt
        })
      };
    }

    // Mark as checked in
    await updateRegistration(eventId, registration.rowKey, {
      checkedIn: true,
      checkedInAt: new Date().toISOString()
    });

    logAudit('event', eventId, 'attendee_checked_in', user.userDetails, { attendee: registration.fullName, ticketCode }, context);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'checked_in',
        attendeeName: registration.fullName
      })
    };
  } catch (error) {
    context.log(`checkIn error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
