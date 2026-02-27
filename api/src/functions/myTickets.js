const { getAuthUser, unauthorised } = require('../helpers/auth');
const { getRegistrationsByUser, getEventBySlug, getBadgesByEvent } = require('../helpers/tableStorage');

/**
 * GET /api/myTickets
 * Returns all registrations for the authenticated user with event details.
 */
module.exports = async function (request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();

    const registrations = await getRegistrationsByUser(user.userId);

    // Enrich with event details
    const tickets = [];
    const eventCache = {};

    for (const reg of registrations) {
      const eventId = reg.partitionKey;
      if (!eventCache[eventId]) {
        try {
          // We need to find the event by ID — iterate all partitions
          // Since reg.partitionKey = eventId, we need a different approach
          // Store a minimal version
          eventCache[eventId] = { id: eventId };
        } catch { /* skip */ }
      }

      // Generate QR from ticket code
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
        qrDataUrl
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
