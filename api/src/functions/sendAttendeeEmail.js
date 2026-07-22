const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { getRegistrationsByEvent, getEventById } = require('../helpers/tableStorage');
const { sendAttendeeEmail } = require('../helpers/emailService');
const { sanitiseFields } = require('../helpers/sanitise');
const { logAudit } = require('../helpers/auditLog');
const { checkRateLimit, getClientIP } = require('../helpers/rateLimiter');

const VALID_AUDIENCES = new Set([
  'selected',
  'volunteer-interest',
  'volunteer-role',
  'volunteer-all'
]);

/**
 * POST /api/sendAttendeeEmail
 * Admin-only: send a custom event update to selected registrations.
 */
module.exports = async function (request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only chapter leads can email attendees');

    let body;
    try {
      body = await request.json();
    } catch {
      return {
        status: 400,
        jsonBody: { error: 'Invalid JSON' }
      };
    }

    const clean = sanitiseFields(body, ['subject', 'message']);
    const eventId = typeof clean.eventId === 'string' ? clean.eventId.trim() : '';
    const subject = typeof clean.subject === 'string' ? clean.subject.replace(/[\r\n]+/g, ' ').trim() : '';
    const message = typeof clean.message === 'string' ? clean.message.trim() : '';
    const audience = typeof clean.audience === 'string' ? clean.audience.trim() : 'selected';
    const registrationIds = Array.isArray(clean.registrationIds)
      ? [...new Set(clean.registrationIds.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))]
      : [];

    if (!eventId || registrationIds.length === 0 || !subject || !message || !VALID_AUDIENCES.has(audience)) {
      return {
        status: 400,
        jsonBody: { error: 'Event, recipients, subject, and message are required' }
      };
    }
    if (registrationIds.length > 100) {
      return {
        status: 400,
        jsonBody: { error: 'Maximum 100 recipients per request' }
      };
    }
    if (subject.length > 150 || message.length > 5000) {
      return {
        status: 400,
        jsonBody: { error: 'Subject must be 150 characters or fewer and message must be 5,000 characters or fewer' }
      };
    }

    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP, 'sendAttendeeEmail', 5)) {
      return {
        status: 429,
        jsonBody: { error: 'Too many attendee email requests. Please try again later.' }
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
    if (!await verifyChapterAccess(user, chapterSlug, context)) {
      return forbidden('You do not have permission to manage this event');
    }

    const registrations = await getRegistrationsByEvent(eventId);
    const registrationsById = new Map(registrations.map(registration => [registration.rowKey, registration]));
    let sent = 0;
    const errors = [];

    for (const registrationId of registrationIds) {
      const registration = registrationsById.get(registrationId);
      if (!registration) {
        errors.push({ id: registrationId, error: 'Registration not found' });
        continue;
      }
      if (!registrationMatchesAudience(registration, audience)) {
        errors.push({ id: registrationId, error: 'Registration is not part of the selected audience' });
        continue;
      }

      try {
        await sendAttendeeEmail({
          fullName: registration.fullName,
          email: registration.email
        }, event, subject, message, context);
        sent++;
      } catch (emailError) {
        context.log(`Attendee email failed for ${registration.email}: ${emailError.message}`);
        errors.push({ id: registrationId, email: registration.email, error: 'Email send failed' });
      }
    }

    logAudit('event', eventId, 'attendee_email_sent', user.userDetails, {
      subject,
      sent,
      failed: errors.length,
      audience,
      registrationIds
    }, context);

    return {
      status: 200,
      jsonBody: {
        success: true,
        sent,
        failed: errors.length,
        errors: errors.length ? errors : undefined
      }
    };

    function registrationMatchesAudience(registration, audience) {
      if (audience === 'selected') return true;
      const role = registration.role || 'attendee';
      const interested = registration.volunteerInterest === true || registration.volunteerInterest === 'true';
      if (audience === 'volunteer-interest') return interested;
      if (audience === 'volunteer-role') return role === 'volunteer';
      return interested || role === 'volunteer';
    }

    module.exports.registrationMatchesAudience = registrationMatchesAudience;
  } catch (error) {
    context.log(`sendAttendeeEmail error: ${error.message}`);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' }
    };
  }
};
