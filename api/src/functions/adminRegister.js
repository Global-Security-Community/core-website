const { randomUUID, randomBytes } = require('crypto');
const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { getEventById, storeRegistration, getRegistrationsByEvent, VALID_ROLES } = require('../helpers/tableStorage');
const { stripHtml } = require('../helpers/sanitise');
const { sendTicketEmail } = require('../helpers/emailService');
const { logAudit } = require('../helpers/auditLog');

/**
 * POST /api/adminRegister
 * Admin-only: register a person with a specific role (bypasses cap for speaker/sponsor/organiser).
 */
module.exports = async function (request, context) {
  context.log('Admin registration request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only chapter leads can admin-register');

    let body;
    try { body = await request.json(); } catch {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { eventId, name, email, role } = body;

    if (!eventId || !name || !email) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing eventId, name, or email' }) };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Please enter a valid email address' }) };
    }

    const assignedRole = role || 'attendee';
    if (!VALID_ROLES.includes(assignedRole)) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }) };
    }

    const event = await getEventById(eventId);
    if (!event) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Event not found' }) };
    }

    // Verify admin has access to this event's chapter
    const chapterSlug = event.chapterSlug || event.partitionKey || '';
    if (!await verifyChapterAccess(user, chapterSlug, context)) {
      return forbidden('You do not have permission to register attendees for this event');
    }

    if (event.status === 'completed') {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Cannot register for a completed event' }) };
    }

    // Check for duplicate by email
    const existingRegs = await getRegistrationsByEvent(eventId);
    const alreadyRegistered = existingRegs.find(r => r.email.toLowerCase() === email.trim().toLowerCase());
    if (alreadyRegistered) {
      return { status: 409, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'This email is already registered for this event' }) };
    }

    // Check capacity — speaker/sponsor/organiser bypass
    const capBypassRoles = ['speaker', 'sponsor', 'organiser'];
    const cap = event.registrationCap || 0;
    if (cap > 0 && existingRegs.length >= cap && !capBypassRoles.includes(assignedRole)) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Event is at capacity. Only speaker, sponsor, or organiser roles can bypass the cap.' }) };
    }

    const ticketCode = randomBytes(5).toString('hex').substring(0, 8).toUpperCase();
    const registrationId = randomUUID();

    const registration = {
      id: registrationId,
      eventId,
      userId: '',
      fullName: stripHtml(name).trim(),
      email: stripHtml(email).trim(),
      company: '',
      ticketCode,
      role: assignedRole
    };

    await storeRegistration(registration);

    // Generate QR and send ticket email
    let qrDataUrl = '';
    try {
      const QRCode = require('qrcode');
      qrDataUrl = await QRCode.toDataURL(ticketCode, { width: 200, margin: 1 });
    } catch (qrErr) {
      context.log(`QR generation failed: ${qrErr.message}`);
    }

    let emailSent = false;
    try {
      context.log(`Sending ticket email to ${registration.email} for event ${eventId}`);
      await sendTicketEmail(registration, event, qrDataUrl, context);
      emailSent = true;
    } catch (emailErr) {
      context.log(`Ticket email send failed (non-fatal): ${emailErr.message}`);
    }

    context.log(`Admin registered ${email} as ${assignedRole} for event ${eventId} by ${user.userDetails}`);
    logAudit('event', eventId, 'registration_admin_created', user.userDetails, { email, role: assignedRole, registrationId }, context);

    return {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        emailSent,
        registration: { id: registrationId, ticketCode, role: assignedRole, fullName: registration.fullName, email: registration.email }
      })
    };
  } catch (error) {
    context.log(`adminRegister error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
