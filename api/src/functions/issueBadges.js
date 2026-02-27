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

    const { eventId, chapterSlug, badgeType, recipients } = body;
    // badgeType: 'Attendee' | 'Speaker' | 'Organiser'
    // recipients: optional array of { name, email } for Speaker/Organiser

    if (!eventId || !chapterSlug || !badgeType) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing eventId, chapterSlug, or badgeType' }) };
    }

    const event = await getEvent(chapterSlug, eventId);
    if (!event) {
      return { status: 404, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Event not found' }) };
    }

    let recipientList = [];

    if (badgeType === 'Attendee') {
      // Issue badges to all checked-in attendees
      const registrations = await getRegistrationsByEvent(eventId);
      recipientList = registrations
        .filter(r => r.checkedIn)
        .map(r => ({ name: r.fullName, email: r.email, userId: r.userId }));
    } else if (recipients && Array.isArray(recipients)) {
      recipientList = recipients.map(r => ({ name: r.name, email: r.email, userId: '' }));
    }

    if (recipientList.length === 0) {
      return { status: 200, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ success: true, issued: 0, message: 'No eligible recipients found' }) };
    }

    let issued = 0;
    const errors = [];

    for (const recipient of recipientList) {
      try {
        const badgeId = randomUUID();
        const badgeSvg = generateBadge({
          recipientName: recipient.name,
          eventTitle: event.title,
          eventDate: event.date,
          eventLocation: event.location,
          badgeType
        });

        await storeBadge({
          id: badgeId,
          eventId,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          badgeType,
          userId: recipient.userId || ''
        });

        try {
          await sendBadgeEmail(recipient, badgeSvg, event, badgeType, context);
        } catch (emailErr) {
          context.log(`Badge email failed for ${recipient.email}: ${emailErr.message}`);
        }

        issued++;
      } catch (err) {
        errors.push({ email: recipient.email, error: err.message });
        context.log(`Badge issue failed for ${recipient.email}: ${err.message}`);
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
