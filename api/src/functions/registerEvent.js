const { randomUUID, randomBytes } = require('crypto');
const { getAuthUser, unauthorised } = require('../helpers/auth');
const { getEventBySlug, storeRegistration, storeDemographics, countRegistrations, getRegistrationsByEvent } = require('../helpers/tableStorage');
const { sanitiseFields } = require('../helpers/sanitise');
const { sendTicketEmail } = require('../helpers/emailService');
const { checkRateLimit, getClientIP } = require('../helpers/rateLimiter');

/**
 * POST /api/registerEvent
 * Authenticated users register for an event.
 */
module.exports = async function (request, context) {
  context.log('Event registration request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();

    // Rate limit: max 10 registrations per IP per hour
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP, 'register', 10)) {
      return { status: 429, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Too many requests. Please try again later.' }) };
    }

    let body;
    try { body = await request.json(); } catch {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { eventSlug, fullName, email, company, employmentStatus, industry, jobTitle, companySize, experienceLevel } = body;

    if (!eventSlug || !fullName || !email) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing required fields: eventSlug, fullName, email' }) };
    }

    const safe = sanitiseFields({ fullName, jobTitle: jobTitle || '', company: company || '' }, ['fullName', 'jobTitle', 'company']);

    // Get the event
    const event = await getEventBySlug(eventSlug);
    if (!event) {
      return { status: 404, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Event not found' }) };
    }

    if (event.status === 'closed' || event.status === 'completed') {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Registration is closed for this event' }) };
    }

    // Check for duplicate registration
    const eventId = event.rowKey;
    const existingRegs = await getRegistrationsByEvent(eventId);
    const alreadyRegistered = existingRegs.find(r => r.userId === user.userId);
    if (alreadyRegistered) {
      return { status: 409, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'You are already registered for this event', ticketCode: alreadyRegistered.ticketCode }) };
    }

    // Check capacity
    const cap = event.registrationCap || 0;
    if (cap > 0 && existingRegs.length >= cap) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'This event has reached capacity' }) };
    }

    // Generate ticket code (8 alphanumeric chars, cryptographically random)
    const ticketCode = randomBytes(5).toString('hex').substring(0, 8).toUpperCase();
    const registrationId = randomUUID();

    const registration = {
      id: registrationId,
      eventId,
      userId: user.userId,
      fullName: safe.fullName.trim(),
      email: email.trim(),
      company: (safe.company || '').trim(),
      ticketCode,
      role: 'attendee'
    };

    await storeRegistration(registration);

    // Store demographics separately (privacy)
    await storeDemographics({
      eventId,
      registrationId,
      employmentStatus: employmentStatus || '',
      industry: industry || '',
      jobTitle: safe.jobTitle || '',
      companySize: companySize || '',
      experienceLevel: experienceLevel || ''
    });

    // Generate QR code
    let qrDataUrl = '';
    try {
      const QRCode = require('qrcode');
      qrDataUrl = await QRCode.toDataURL(ticketCode, { width: 200, margin: 1 });
    } catch (qrErr) {
      context.log(`QR generation failed: ${qrErr.message}`);
    }

    // Send ticket email (non-blocking — don't fail registration if email fails)
    try {
      await sendTicketEmail(registration, event, qrDataUrl, context);
    } catch (emailErr) {
      context.log(`Ticket email send failed (non-fatal): ${emailErr.message}`);
    }

    return {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        registration: {
          id: registrationId,
          ticketCode,
          fullName: safe.fullName.trim(),
          company: (safe.company || '').trim(),
          eventTitle: event.title,
          eventDate: event.date,
          eventLocation: event.location,
          qrDataUrl
        }
      })
    };
  } catch (error) {
    context.log(`registerEvent error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
