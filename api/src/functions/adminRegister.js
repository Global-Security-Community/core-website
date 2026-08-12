const { randomUUID, randomBytes } = require('crypto');
const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { getEventById, storeRegistration, getRegistrationsByEvent, VALID_ROLES } = require('../helpers/tableStorage');
const { stripHtml } = require('../helpers/sanitise');
const { sendTicketEmail } = require('../helpers/emailService');
const { logAudit } = require('../helpers/auditLog');
const { runInChunks } = require('../helpers/concurrency');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BULK_LIMIT = 50;

function jsonResponse(status, body) {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function normalisePerson(name, email) {
  return {
    name: stripHtml(String(name || '')).trim(),
    email: stripHtml(String(email || '')).trim()
  };
}

async function createRegistration({ eventId, name, email, role }, event, user, context) {
  const ticketCode = randomBytes(5).toString('hex').substring(0, 8).toUpperCase();
  const registrationId = randomUUID();
  const registration = {
    id: registrationId,
    eventId,
    userId: '',
    fullName: name,
    email,
    company: '',
    ticketCode,
    role
  };

  await storeRegistration(registration);

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

  logAudit(
    'event',
    eventId,
    'registration_admin_created',
    user.userDetails,
    { email, role, registrationId },
    context
  );

  return {
    id: registrationId,
    ticketCode,
    role,
    fullName: registration.fullName,
    email: registration.email,
    emailSent
  };
}

/**
 * POST /api/manualRegister
 * Admin-only: register one person, or up to 50 speakers in a bulk request.
 */
module.exports = async function (request, context) {
  context.log('Admin registration request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only chapter leads can admin-register');

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON' });
    }

    const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
    if (!eventId) return jsonResponse(400, { error: 'Missing eventId' });
    const assignedRole = body.role || 'attendee';
    if (!Array.isArray(body.registrations) && !VALID_ROLES.includes(assignedRole)) {
      return jsonResponse(400, { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const event = await getEventById(eventId);
    if (!event) return jsonResponse(400, { error: 'Event not found' });

    const chapterSlug = event.chapterSlug || event.partitionKey || '';
    if (!await verifyChapterAccess(user, chapterSlug, context)) {
      return forbidden('You do not have permission to register attendees for this event');
    }
    if (event.status === 'completed') {
      return jsonResponse(400, { error: 'Cannot register for a completed event' });
    }

    const existingRegistrations = await getRegistrationsByEvent(eventId);
    const existingEmails = new Set(existingRegistrations.map(registration =>
      String(registration.email || '').trim().toLowerCase()
    ));

    if (Array.isArray(body.registrations)) {
      if (!body.registrations.length) {
        return jsonResponse(400, { error: 'At least one speaker is required' });
      }
      if (body.registrations.length > BULK_LIMIT) {
        return jsonResponse(400, { error: `A maximum of ${BULK_LIMIT} speakers can be registered at once` });
      }

      const results = new Array(body.registrations.length);
      const pending = [];
      const submittedEmails = new Set();

      body.registrations.forEach((entry, index) => {
        const person = normalisePerson(entry?.name, entry?.email);
        const normalisedEmail = person.email.toLowerCase();
        if (!person.name || !person.email) {
          results[index] = { row: index + 1, ...person, success: false, error: 'Name and email are required' };
        } else if (!EMAIL_PATTERN.test(person.email)) {
          results[index] = { row: index + 1, ...person, success: false, error: 'Enter a valid email address' };
        } else if (existingEmails.has(normalisedEmail)) {
          results[index] = { row: index + 1, ...person, success: false, error: 'Already registered for this event' };
        } else if (submittedEmails.has(normalisedEmail)) {
          results[index] = { row: index + 1, ...person, success: false, error: 'Duplicate email in this list' };
        } else {
          submittedEmails.add(normalisedEmail);
          pending.push({ index, ...person });
        }
      });

      await runInChunks(pending, 5, async person => {
        try {
          const registration = await createRegistration(
            { eventId, name: person.name, email: person.email, role: 'speaker' },
            event,
            user,
            context
          );
          results[person.index] = {
            row: person.index + 1,
            name: person.name,
            email: person.email,
            success: true,
            emailSent: registration.emailSent
          };
        } catch (error) {
          context.log(`Bulk speaker registration failed for row ${person.index + 1}: ${error.message}`);
          results[person.index] = {
            row: person.index + 1,
            name: person.name,
            email: person.email,
            success: false,
            error: 'Registration could not be saved'
          };
        }
      });

      const registered = results.filter(result => result.success).length;
      const failed = results.length - registered;
      logAudit(
        'event',
        eventId,
        'speaker_bulk_registered',
        user.userDetails,
        { submitted: results.length, registered, failed },
        context
      );
      return jsonResponse(200, { success: failed === 0, registered, failed, results });
    }

    const person = normalisePerson(body.name, body.email);
    if (!person.name || !person.email) {
      return jsonResponse(400, { error: 'Missing eventId, name, or email' });
    }
    if (!EMAIL_PATTERN.test(person.email)) {
      return jsonResponse(400, { error: 'Please enter a valid email address' });
    }
    if (existingEmails.has(person.email.toLowerCase())) {
      return jsonResponse(409, { error: 'This email is already registered for this event' });
    }

    const capBypassRoles = ['speaker', 'sponsor', 'organiser'];
    const cap = event.registrationCap || 0;
    if (cap > 0 && existingRegistrations.length >= cap && !capBypassRoles.includes(assignedRole)) {
      return jsonResponse(400, {
        error: 'Event is at capacity. Only speaker, sponsor, or organiser roles can bypass the cap.'
      });
    }

    const registration = await createRegistration(
      { eventId, name: person.name, email: person.email, role: assignedRole },
      event,
      user,
      context
    );
    context.log(`Admin registered ${person.email} as ${assignedRole} for event ${eventId} by ${user.userDetails}`);

    return jsonResponse(201, {
      success: true,
      emailSent: registration.emailSent,
      registration: {
        id: registration.id,
        ticketCode: registration.ticketCode,
        role: registration.role,
        fullName: registration.fullName,
        email: registration.email
      }
    });
  } catch (error) {
    context.log(`adminRegister error: ${error.message}`);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};
