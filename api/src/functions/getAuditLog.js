const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { getAuditLog } = require('../helpers/auditLog');

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
    const slug = chapterSlug || '';
    if (slug && !await verifyChapterAccess(user, slug, context)) {
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
