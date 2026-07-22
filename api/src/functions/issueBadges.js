const { createHash } = require('crypto');
const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { getRegistrationsByEvent, getEvent, storeBadge, deleteBadge, getBadgesByEvent } = require('../helpers/tableStorage');
const { generateSharedEventBadgePng } = require('../helpers/badgeGenerator');
const { downloadGeneratedImage } = require('../helpers/imageGenerator');
const { sendBadgeEmail } = require('../helpers/emailService');
const { logAudit } = require('../helpers/auditLog');
const { checkRateLimit, getClientIP } = require('../helpers/rateLimiter');

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
    const requestedBatchSize = Number(body.batchSize) || 20;
    const batchSize = Math.min(Math.max(requestedBatchSize, 1), 20);

    if (!eventId || !chapterSlug) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing eventId or chapterSlug' }) };
    }

    // A booked-out 200-person event needs 10 batches of 20.
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP, 'issueBadges', 15)) {
      return { status: 429, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Too many requests. Please try again later.' }) };
    }

    const event = await getEvent(chapterSlug, eventId);
    if (!event) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Event not found' }) };
    }

    // Only allow badge issuance for completed events
    if (event.status !== 'completed') {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Badges can only be issued for completed events' }) };
    }

    // Verify admin has access to this chapter
    if (!await verifyChapterAccess(user, chapterSlug, context)) {
      return forbidden('You do not have permission to issue badges for this chapter');
    }

    // Issue badges to all checked-in registrations, grouped by role
    const registrations = await getRegistrationsByEvent(eventId);
    const checkedInRegs = registrations.filter(r => r.checkedIn === true || r.checkedIn === 'true');

    if (checkedInRegs.length === 0) {
      return { status: 200, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ success: true, issued: 0, remaining: 0, message: 'No eligible recipients found' }) };
    }

    // Check for already-issued badges to prevent duplicates
    const existingBadges = await getBadgesByEvent(eventId);
    const issuedEmails = new Set(existingBadges.map(b => (b.recipientEmail || '').toLowerCase()));
    const eligibleRegs = checkedInRegs.filter(reg => !issuedEmails.has((reg.email || '').toLowerCase()));
    const batch = eligibleRegs.slice(0, batchSize);

    let issued = 0;
    const errors = [];

    // Download the finalized shared badge variants from private Blob Storage.
    let attendeeBadgeBuffer = null;
    let speakerBadgeBuffer = null;
    let organiserBadgeBuffer = null;
    if (event.badgeImageUrl) {
      try {
        attendeeBadgeBuffer = await downloadGeneratedImage(event.badgeImageUrl);
      } catch (e) { context.log(`Could not fetch badge background: ${e.message}`); }
    }
    if (event.speakerBadgeImageUrl) {
      try {
        speakerBadgeBuffer = await downloadGeneratedImage(event.speakerBadgeImageUrl);
      } catch (e) { context.log(`Could not fetch speaker badge: ${e.message}`); }
    }
    if (event.organiserBadgeImageUrl) {
      try {
        organiserBadgeBuffer = await downloadGeneratedImage(event.organiserBadgeImageUrl);
      } catch (e) { context.log(`Could not fetch organiser badge: ${e.message}`); }
    }
    attendeeBadgeBuffer = attendeeBadgeBuffer || await generateSharedEventBadgePng({
      eventTitle: event.title,
      eventDate: event.date,
      eventLocation: event.location,
      badgeType: 'Attendee'
    }, null);
    speakerBadgeBuffer = speakerBadgeBuffer || await generateSharedEventBadgePng({
      eventTitle: event.title,
      eventDate: event.date,
      eventLocation: event.location,
      badgeType: 'Speaker'
    }, null);
    organiserBadgeBuffer = organiserBadgeBuffer || await generateSharedEventBadgePng({
      eventTitle: event.title,
      eventDate: event.date,
      eventLocation: event.location,
      badgeType: 'Organiser'
    }, null);

    for (const reg of batch) {
      const badgeType = reg.role === 'speaker' ? 'Speaker' : reg.role === 'organiser' ? 'Organiser' : 'Attendee';
      const badgeBuffer = badgeType === 'Speaker'
        ? speakerBadgeBuffer
        : badgeType === 'Organiser'
          ? organiserBadgeBuffer
          : attendeeBadgeBuffer;
      const badgeContent = badgeBuffer.toString('base64');
      const badgeId = createHash('sha256')
        .update(`${eventId}\0${(reg.email || '').toLowerCase()}`)
        .digest('hex')
        .slice(0, 32);
      try {
        // The deterministic row key reserves this recipient and prevents concurrent duplicate sends.
        await storeBadge({
          id: badgeId,
          eventId,
          recipientEmail: reg.email,
          recipientName: reg.fullName,
          badgeType,
          userId: reg.userId || ''
        });

        try {
          await sendBadgeEmail(
            { name: reg.fullName, email: reg.email },
            badgeContent,
            event,
            badgeType,
            context,
            'image/png',
            `gsc-${badgeType.toLowerCase()}-badge.png`
          );
        } catch (emailErr) {
          await deleteBadge(eventId, badgeId);
          context.log(`Badge email failed for ${reg.email}: ${emailErr.message}`);
          errors.push({ email: reg.email, error: 'Email send failed' });
          continue;
        }

        issued++;
      } catch (err) {
        // A create conflict means another request already reserved or sent this badge.
        if (err.statusCode === 409) continue;
        errors.push({ email: reg.email, error: 'Badge issuance failed' });
        context.log(`Badge issue failed for ${reg.email}: ${err.message}`);
      }
    }

    logAudit('event', eventId, 'badges_issued', user.userDetails, { issued, total: checkedInRegs.length, errors: errors.length }, context);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        issued,
        total: checkedInRegs.length,
        remaining: Math.max(eligibleRegs.length - batch.length, 0),
        errors: errors.length > 0 ? errors : undefined
      })
    };
  } catch (error) {
    context.log(`issueBadges error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
