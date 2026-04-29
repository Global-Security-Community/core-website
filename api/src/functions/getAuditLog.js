const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { getAuditLog } = require('../helpers/auditLog');
const { getEventById } = require('../helpers/tableStorage');

/**
 * GET /api/getAuditLog?eventId={eventId}&chapterSlug={chapterSlug}
 * Admin-only: returns audit trail for an event.
 *
 * GET /api/getAuditLog?chapterSlug={chapterSlug}
 * Admin-only: returns audit trail for a chapter.
 */
module.exports = async function (request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Admin access required');

    const url = new URL(request.url);
    const eventId = url.searchParams.get('eventId');
    const chapterSlug = url.searchParams.get('chapterSlug');

    if (!eventId && !chapterSlug) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing eventId or chapterSlug parameter' })
      };
    }

    // Verify admin has access to this chapter
    let verifiedSlug = chapterSlug || '';

    // When eventId is provided without chapterSlug, look up the event's chapter
    if (eventId && !chapterSlug) {
      const event = await getEventById(eventId);
      if (event) {
        verifiedSlug = event.chapterSlug || event.partitionKey || '';
      }
    }

    if (verifiedSlug && !await verifyChapterAccess(user, verifiedSlug, context)) {
      return forbidden('You do not have permission to view this audit log');
    }
    if (!verifiedSlug && eventId) {
      // Event not found — deny access rather than skipping check
      return forbidden('You do not have permission to view this audit log');
    }

    let entries = [];
    if (eventId) {
      entries = await getAuditLog('event', eventId);
    } else if (chapterSlug) {
      entries = await getAuditLog('chapter', chapterSlug);
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries })
    };
  } catch (error) {
    context.log(`getAuditLog error: ${error.message}`);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
