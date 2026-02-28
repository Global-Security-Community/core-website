const { getAuthUser, hasRole, unauthorised, forbidden } = require('../helpers/auth');
const { getRegistrationByTicketCode, updateRegistration } = require('../helpers/tableStorage');

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
