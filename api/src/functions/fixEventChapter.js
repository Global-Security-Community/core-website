const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { moveEventToChapter } = require('../helpers/tableStorage');

/**
 * POST /api/fixEventChapter
 * Admin-only: reassign an event to a different chapter.
 * This is necessary when an event was created with an incorrect chapterSlug
 * because Azure Table Storage partition keys cannot be updated in-place.
 * Body: { eventId, oldChapterSlug, newChapterSlug }
 */
module.exports = async function (request, context) {
  context.log('Fix event chapter request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only admins can reassign events');

    let body;
    try { body = await request.json(); } catch {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { eventId, oldChapterSlug, newChapterSlug } = body;
    if (!eventId || !oldChapterSlug || !newChapterSlug) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing required fields: eventId, oldChapterSlug, newChapterSlug' }) };
    }

    if (oldChapterSlug.toLowerCase().trim() === newChapterSlug.toLowerCase().trim()) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'oldChapterSlug and newChapterSlug must be different' }) };
    }

    // Verify admin has access to both the source and target chapters
    if (!await verifyChapterAccess(user, oldChapterSlug, context)) {
      return forbidden('You do not have permission to manage the source chapter');
    }
    if (!await verifyChapterAccess(user, newChapterSlug, context)) {
      return forbidden('You do not have permission to manage the target chapter');
    }

    await moveEventToChapter(
      oldChapterSlug.toLowerCase().trim(),
      eventId,
      newChapterSlug.toLowerCase().trim()
    );

    context.log(`Event ${eventId} moved from chapter '${oldChapterSlug}' to '${newChapterSlug}'`);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, eventId, newChapterSlug: newChapterSlug.toLowerCase().trim() })
    };
  } catch (error) {
    context.log(`fixEventChapter error: ${error.message}`);
    if (error.statusCode === 404 || error.statusCode === 409) {
      return { status: error.statusCode, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: error.statusCode === 404 ? 'Event not found' : 'Conflict — event may have been modified' }) };
    }
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
