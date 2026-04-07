const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { getRegistrationsByEvent, getEventById, getPartnersByEvent } = require('../helpers/tableStorage');
const { sendTicketEmail } = require('../helpers/emailService');

/**
 * POST /api/resendTicketEmail
 * Admin-only: resend ticket confirmation emails to selected registrations.
 */
module.exports = async function (request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only chapter leads can resend emails');

    let body;
    try { body = await request.json(); } catch {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { eventId, registrationIds } = body;

    if (!eventId || !registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing eventId or registrationIds (array)' }) };
    }

    const event = await getEventById(eventId);
    if (!event) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Event not found' }) };
    }

    const chapterSlug = event.chapterSlug || event.partitionKey || '';
    if (!await verifyChapterAccess(user, chapterSlug, context)) {
      return forbidden('You do not have permission to manage this event');
    }

    const registrations = await getRegistrationsByEvent(eventId);
    const regMap = {};
    registrations.forEach(r => { regMap[r.rowKey] = r; });

    let partners = [];
    try { partners = await getPartnersByEvent(eventId); } catch { /* non-critical */ }

    let sent = 0;
    const errors = [];

    for (const regId of registrationIds) {
      const reg = regMap[regId];
      if (!reg) {
        errors.push({ id: regId, error: 'Registration not found' });
        continue;
      }

      // Build registration object matching sendTicketEmail expectations
      const registration = {
        fullName: reg.fullName,
        email: reg.email,
        ticketCode: reg.ticketCode
      };

      // Generate QR code
      let qrDataUrl = '';
      try {
        const QRCode = require('qrcode');
        qrDataUrl = await QRCode.toDataURL(reg.ticketCode, { width: 200, margin: 1 });
      } catch (qrErr) {
        context.log(`QR generation failed for ${reg.ticketCode}: ${qrErr.message}`);
      }

      try {
        await sendTicketEmail(registration, event, qrDataUrl, context, partners);
        sent++;
        context.log(`Resent ticket email to ${reg.email} for event ${eventId}`);
      } catch (emailErr) {
        context.log(`Resend email failed for ${reg.email}: ${emailErr.message}`);
        errors.push({ id: regId, email: reg.email, error: emailErr.message });
      }
    }

    context.log(`Resent ${sent}/${registrationIds.length} ticket emails for event ${eventId} by ${user.userDetails}`);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, sent, failed: errors.length, errors: errors.length > 0 ? errors : undefined })
    };
  } catch (error) {
    context.log(`resendTicketEmail error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
