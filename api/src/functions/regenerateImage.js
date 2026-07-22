const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { getEvent, updateEvent } = require('../helpers/tableStorage');
const { generateEventBadgeBackground, downloadGeneratedImage } = require('../helpers/imageGenerator');
const { isImageConfigured } = require('../helpers/aiProvider');
const { logAudit } = require('../helpers/auditLog');
const { checkRateLimit, getClientIP } = require('../helpers/rateLimiter');

/**
 * POST /api/regenerateImage
 * Admin-only: generate custom artwork for an event's attendee badges.
 */
module.exports = async function (request, context) {
  context.log('Generate event badge artwork request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only chapter leads can generate badge artwork');

    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON' } };
    }

    const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
    const chapterSlug = typeof body.chapterSlug === 'string' ? body.chapterSlug.trim() : '';
    if (!eventId || !chapterSlug) {
      return { status: 400, jsonBody: { error: 'Event and chapter are required' } };
    }
    if (!isImageConfigured()) {
      return { status: 503, jsonBody: { error: 'Azure OpenAI image generation is not configured' } };
    }
    if (!checkRateLimit(getClientIP(request), 'regenerateEventBadge', 5)) {
      return { status: 429, jsonBody: { error: 'Too many image generation requests. Please try again later.' } };
    }

    const event = await getEvent(chapterSlug, eventId);
    if (!event) {
      return { status: 400, jsonBody: { error: 'Event not found' } };
    }
    if (!await verifyChapterAccess(user, chapterSlug, context)) {
      return forbidden('You do not have permission to manage this event');
    }

    const city = event.locationCity || event.location || chapterSlug.replace(/-/g, ' ');
    const artwork = await generateEventBadgeBackground(
      event.title,
      city,
      chapterSlug,
      event.slug || eventId,
      event.date,
      context
    );
    await updateEvent(chapterSlug, eventId, {
      badgeImageUrl: artwork.attendeeImageUrl,
      speakerBadgeImageUrl: artwork.speakerImageUrl,
      organiserBadgeImageUrl: artwork.organiserImageUrl
    });

    const [attendeeBuffer, speakerBuffer, organiserBuffer] = await Promise.all([
      downloadGeneratedImage(artwork.attendeeImageUrl),
      downloadGeneratedImage(artwork.speakerImageUrl),
      downloadGeneratedImage(artwork.organiserImageUrl)
    ]);
    logAudit('event', eventId, 'badge_artwork_generated', user.userDetails, {}, context);

    return {
      status: 200,
      jsonBody: {
        success: true,
        attendeeImageDataUrl: `data:image/png;base64,${attendeeBuffer.toString('base64')}`,
        speakerImageDataUrl: `data:image/png;base64,${speakerBuffer.toString('base64')}`,
        organiserImageDataUrl: `data:image/png;base64,${organiserBuffer.toString('base64')}`,
        themeYear: artwork.themeYear,
        themeCreated: artwork.themeCreated,
        chapterThemeCreated: artwork.chapterThemeCreated
      }
    };
  } catch (error) {
    context.log(`regenerateImage error: ${error.message}`);
    return {
      status: 500,
      jsonBody: { error: 'Badge artwork generation failed. Check the Azure OpenAI deployment and try again.' }
    };
  }
};
