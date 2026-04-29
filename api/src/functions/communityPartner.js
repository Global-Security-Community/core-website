const { randomUUID } = require('crypto');
const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { storePartner, deletePartner, getEventById } = require('../helpers/tableStorage');
const { stripHtml } = require('../helpers/sanitise');
const { logAudit } = require('../helpers/auditLog');

const MAX_LOGO_SIZE = 200 * 1024; // 200KB base64

/**
 * POST /api/communityPartner
 * Admin-only: add, update, or delete a community partner.
 * Body for add/update: { eventId, name, tier, logoBase64, logoContentType, website, partnerId? }
 * Body for delete: { eventId, partnerId, action: 'delete' }
 */
module.exports = async function (request, context) {
  context.log('Community partner request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only event organisers can manage community partners');

    let body;
    try { body = await request.json(); } catch {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { eventId, partnerId, action } = body;

    if (!eventId) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing eventId' }) };
    }

    // Verify admin has access to this event's chapter
    const event = await getEventById(eventId);
    if (!event) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Event not found' }) };
    }
    const chapterSlug = event.chapterSlug || event.partitionKey || '';
    if (!await verifyChapterAccess(user, chapterSlug, context)) {
      return forbidden('You do not have permission to manage partners for this event');
    }

    // Delete action
    if (action === 'delete') {
      if (!partnerId) {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Missing partnerId for delete' }) };
      }
      await deletePartner(eventId, partnerId);
      logAudit('event', eventId, 'partner_deleted', user.userDetails, { partnerId }, context);
      return { status: 200, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ success: true, message: 'Community partner removed' }) };
    }

    // Add/update
    const { name, tier, logoBase64, logoContentType, website } = body;

    if (!name) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing partner name' }) };
    }

    if (!logoBase64) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing logo image' }) };
    }

    // Validate logo size (base64 string length)
    if (logoBase64.length > MAX_LOGO_SIZE) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Logo too large. Please resize to under 400px wide.' }) };
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
    if (logoContentType && !validTypes.includes(logoContentType)) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Logo must be PNG, JPG, or SVG' }) };
    }

    const safeName = stripHtml(name).substring(0, 100);
    const safeTier = stripHtml(tier || '').substring(0, 50);

    // Validate website URL scheme (only allow http/https)
    let safeWebsite = '';
    if (website) {
      try {
        const parsed = new URL(website);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          safeWebsite = website.substring(0, 300);
        }
      } catch { /* invalid URL — discard */ }
    }

    const id = partnerId || randomUUID();

    await storePartner({
      id,
      eventId,
      name: safeName,
      tier: safeTier,
      logoBase64,
      logoContentType: logoContentType || 'image/png',
      website: safeWebsite,
      displayOrder: body.displayOrder || 0
    });

    context.log(`Community partner ${safeName} saved for event ${eventId}`);
    logAudit('event', eventId, partnerId ? 'partner_updated' : 'partner_added', user.userDetails, { partnerId: id, name: safeName, tier: safeTier }, context);

    return {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, partner: { id, name: safeName, tier: safeTier } })
    };
  } catch (error) {
    context.log(`communityPartner error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
