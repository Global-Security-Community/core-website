const { getAuthUser, unauthorised } = require('../helpers/auth');
const { getBadge } = require('../helpers/tableStorage');
const { generateBadge } = require('../helpers/badgeGenerator');

/**
 * GET /api/badge?eventId={eventId}&badgeId={badgeId}
 * Authenticated users can download their own badge.
 */
module.exports = async function (request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();

    const url = new URL(request.url);
    const eventId = url.searchParams.get('eventId');
    const badgeId = url.searchParams.get('badgeId');

    if (!eventId || !badgeId) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing eventId or badgeId' }) };
    }

    const badge = await getBadge(eventId, badgeId);
    if (!badge) {
      return { status: 404, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Badge not found' }) };
    }

    // Security: only badge owner or admin can download
    const isOwner = badge.userId && badge.userId === user.userId;
    const isAdmin = user.userRoles.includes('admin');
    if (!isOwner && !isAdmin) {
      return { status: 403, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'You can only download your own badges' }) };
    }

    // Regenerate the SVG (stateless — no file storage needed)
    const svg = generateBadge({
      recipientName: badge.recipientName,
      eventTitle: badge.partitionKey, // we'll need event details
      eventDate: '',
      eventLocation: '',
      badgeType: badge.badgeType
    });

    return {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Content-Disposition': `inline; filename="gsc-badge-${badge.badgeType.toLowerCase()}.svg"`
      },
      body: svg
    };
  } catch (error) {
    context.log(`badge download error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
