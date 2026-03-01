const { randomUUID } = require('crypto');
const { getAuthUser, hasRole, unauthorised, forbidden } = require('../helpers/auth');
const { getRegistrationsByEvent, getEvent, storeBadge, getBadgesByEvent } = require('../helpers/tableStorage');
const { generateBadge } = require('../helpers/badgeGenerator');
const { sendBadgeEmail } = require('../helpers/emailService');

/**
 * POST /api/issueBadges
 * Admin-only: issue badges for a completed event.
 */
module.exports = async function (request, context) {
  context.log('Issue badges request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only event organisers can issue badges');

    let body;
    try { body = await request.json(); } catch {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { eventId, chapterSlug } = body;

    if (!eventId || !chapterSlug) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing eventId or chapterSlug' }) };
    }

    const event = await getEvent(chapterSlug, eventId);
    if (!event) {
      return { status: 404, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Event not found' }) };
    }

    // Issue badges to all checked-in registrations, grouped by role
    const registrations = await getRegistrationsByEvent(eventId);
    const checkedInRegs = registrations.filter(r => r.checkedIn === true || r.checkedIn === 'true');

    if (checkedInRegs.length === 0) {
      return { status: 200, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ success: true, issued: 0, message: 'No eligible recipients found' }) };
    }

    // Map role to badge type (capitalised)
    const roleToBadgeType = {
      attendee: 'Attendee',
      volunteer: 'Volunteer',
      speaker: 'Speaker',
      sponsor: 'Sponsor',
      organiser: 'Organiser'
    };

    let issued = 0;
    const errors = [];

    for (const reg of checkedInRegs) {
      try {
        const role = reg.role || 'attendee';
        const badgeType = roleToBadgeType[role] || 'Attendee';
        const badgeId = randomUUID();
        const badgeSvg = generateBadge({
          recipientName: reg.fullName,
          eventTitle: event.title,
          eventDate: event.date,
          eventLocation: event.location,
          badgeType
        });

        await storeBadge({
          id: badgeId,
          eventId,
          recipientEmail: reg.email,
          recipientName: reg.fullName,
          badgeType,
          userId: reg.userId || ''
        });

        try {
          await sendBadgeEmail({ name: reg.fullName, email: reg.email }, badgeSvg, event, badgeType, context);
        } catch (emailErr) {
          context.log(`Badge email failed for ${reg.email}: ${emailErr.message}`);
        }

        issued++;
      } catch (err) {
        errors.push({ email: reg.email, error: err.message });
        context.log(`Badge issue failed for ${reg.email}: ${err.message}`);
      }
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, issued, total: recipientList.length, errors: errors.length > 0 ? errors : undefined })
    };
  } catch (error) {
    context.log(`issueBadges error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
