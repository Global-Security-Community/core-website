const { randomUUID } = require('crypto');
const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { getRegistrationsByEvent, getEvent, storeBadge, getBadgesByEvent } = require('../helpers/tableStorage');
const { generateBadge, generateBadgePng } = require('../helpers/badgeGenerator');
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

    if (!eventId || !chapterSlug) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing eventId or chapterSlug' }) };
    }

    // Rate limit: max 5 badge issuance requests per hour
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP, 'issueBadges', 5)) {
      return { status: 429, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Too many requests. Please try again later.' }) };
    }

    const event = await getEvent(chapterSlug, eventId);
    if (!event) {
      return { status: 404, headers: { 'Content-Type': 'application/json' },
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
               body: JSON.stringify({ success: true, issued: 0, message: 'No eligible recipients found' }) };
    }

    // Check for already-issued badges to prevent duplicates
    const existingBadges = await getBadgesByEvent(eventId);
    const issuedEmails = new Set(existingBadges.map(b => (b.recipientEmail || '').toLowerCase()));

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

    // Try to download AI-generated background for PNG badges
    let backgroundBuffer = null;
    if (event.badgeImageUrl) {
      try {
        // Validate URL is HTTPS and not a private/internal address
        const badgeUrl = new URL(event.badgeImageUrl);
        if (badgeUrl.protocol === 'https:') {
          const bgRes = await fetch(event.badgeImageUrl);
          if (bgRes.ok) backgroundBuffer = Buffer.from(await bgRes.arrayBuffer());
        }
      } catch (e) { context.log(`Could not fetch badge background: ${e.message}`); }
    }

    for (const reg of checkedInRegs) {
      try {
        // Skip if badge already issued to this recipient
        if (issuedEmails.has((reg.email || '').toLowerCase())) continue;

        const role = reg.role || 'attendee';
        const badgeType = roleToBadgeType[role] || 'Attendee';
        const badgeId = randomUUID();
        const badgeOpts = {
          recipientName: reg.fullName,
          eventTitle: event.title,
          eventDate: event.date,
          eventLocation: event.location,
          badgeType
        };

        // Generate PNG badge (with AI background) or fall back to SVG
        let badgeContent, badgeContentType, badgeFileName;
        try {
          const pngBuffer = await generateBadgePng(badgeOpts, backgroundBuffer);
          badgeContent = pngBuffer.toString('base64');
          badgeContentType = 'image/png';
          badgeFileName = `gsc-badge-${badgeType.toLowerCase()}.png`;
        } catch (pngErr) {
          context.log(`PNG badge failed, falling back to SVG: ${pngErr.message}`);
          badgeContent = generateBadge(badgeOpts);
          badgeContentType = 'image/svg+xml';
          badgeFileName = `gsc-badge-${badgeType.toLowerCase()}.svg`;
        }

        await storeBadge({
          id: badgeId,
          eventId,
          recipientEmail: reg.email,
          recipientName: reg.fullName,
          badgeType,
          userId: reg.userId || ''
        });

        try {
          await sendBadgeEmail({ name: reg.fullName, email: reg.email }, badgeContent, event, badgeType, context, badgeContentType, badgeFileName);
        } catch (emailErr) {
          context.log(`Badge email failed for ${reg.email}: ${emailErr.message}`);
        }

        issued++;
      } catch (err) {
        errors.push({ email: reg.email, error: 'Badge generation failed' });
        context.log(`Badge issue failed for ${reg.email}: ${err.message}`);
      }
    }

    logAudit('event', eventId, 'badges_issued', user.userDetails, { issued, total: checkedInRegs.length, errors: errors.length }, context);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, issued, total: checkedInRegs.length, errors: errors.length > 0 ? errors : undefined })
    };
  } catch (error) {
    context.log(`issueBadges error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
