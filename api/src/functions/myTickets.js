const { getAuthUser, unauthorised } = require('../helpers/auth');
const { getRegistrationsByUser, getEventById } = require('../helpers/tableStorage');

/**
 * GET /api/myTickets
 * Returns all registrations for the authenticated user with event details.
 */
module.exports = async function (request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();

    const registrations = await getRegistrationsByUser(user.userId);

    const tickets = [];
    const eventCache = {};

    for (const reg of registrations) {
      const eventId = reg.partitionKey;
      if (!eventCache[eventId]) {
        try {
          eventCache[eventId] = await getEventById(eventId);
        } catch { eventCache[eventId] = null; }
      }
      const event = eventCache[eventId];

      let qrDataUrl = '';
      try {
        const QRCode = require('qrcode');
        qrDataUrl = await QRCode.toDataURL(reg.ticketCode, { width: 200, margin: 1 });
      } catch { /* skip */ }

      tickets.push({
        registrationId: reg.rowKey,
        eventId,
        ticketCode: reg.ticketCode,
        fullName: reg.fullName,
        checkedIn: reg.checkedIn || false,
        checkedInAt: reg.checkedInAt || '',
        registeredAt: reg.registeredAt,
        qrDataUrl,
        eventTitle: event ? event.title : '',
        eventDate: event ? event.date : '',
        eventEndDate: event ? (event.endDate || '') : '',
        eventLocation: event ? event.location : '',
        eventSlug: event ? event.slug : ''
      });
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickets })
    };
  } catch (error) {
    context.log(`myTickets error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
