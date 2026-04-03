const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { getEvent, deleteEvent } = require('../helpers/tableStorage');

/**
 * POST /api/deleteEvent
 * Admin-only: permanently delete an event.
 * Body: { eventId, chapterSlug }
 */
module.exports = async function (request, context) {
  context.log('Delete event request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only admins can delete events');

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

    // Verify event exists
    const existing = await getEvent(chapterSlug, eventId);
    if (!existing) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Event not found' }) };
    }

    // Verify admin has access to this chapter
    if (!await verifyChapterAccess(user, chapterSlug, context)) {
      return forbidden('You do not have permission to delete events for this chapter');
    }

    await deleteEvent(chapterSlug, eventId);
    context.log(`Event ${eventId} deleted by ${user.userId}`);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    context.log(`deleteEvent error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
