const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { updateEvent, getEvent, getEventBySlug } = require('../helpers/tableStorage');
const { sanitiseFields } = require('../helpers/sanitise');
const { logAudit } = require('../helpers/auditLog');

/**
 * POST /api/updateEvent
 * Admin-only: update an existing event's editable fields.
 * Body: { eventId, chapterSlug, ...fields }
 */
module.exports = async function (request, context) {
  context.log('Update event request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only chapter leads can edit events');

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
      return forbidden('You do not have permission to edit events for this chapter');
    }

    // Build updates from allowed fields only
    const updates = {};
    const allowedText = ['title', 'description', 'locationBuilding', 'locationAddress1',
                         'locationAddress2', 'locationCity', 'locationState', 'sessionizeApiId'];

    // Sanitise text fields
    const textFields = {};
    for (const field of allowedText) {
      if (body[field] !== undefined) textFields[field] = body[field];
    }
    if (Object.keys(textFields).length > 0) {
      const safe = sanitiseFields(textFields, Object.keys(textFields));
      Object.assign(updates, safe);
    }

    // Slug update
    if (body.slug !== undefined) {
      const newSlug = String(body.slug)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 80);
      if (!newSlug) {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Slug must contain at least one alphanumeric character' }) };
      }
      // Check uniqueness — reject if another event already uses this slug
      if (newSlug !== existing.slug) {
        const conflict = await getEventBySlug(newSlug);
        if (conflict && conflict.rowKey !== eventId) {
          return { status: 400, headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ error: 'That slug is already in use by another event' }) };
        }
      }
      updates.slug = newSlug;
    }

    // Date fields (not sanitised, validated)
    if (body.date !== undefined) {
      if (!body.date) {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Date is required' }) };
      }
      updates.date = body.date;
    }
    if (body.endDate !== undefined) {
      updates.endDate = body.endDate || '';
    }

    // Numeric fields
    if (body.registrationCap !== undefined) {
      updates.registrationCap = parseInt(body.registrationCap) || 0;
    }

    // Validate lengths
    if (updates.title && updates.title.length > 200) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Title must be 200 characters or less' }) };
    }
    if (updates.description && updates.description.length > 5000) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Description must be 5000 characters or less' }) };
    }

    // Recompose display location if address fields changed
    const addr1 = updates.locationAddress1 !== undefined ? updates.locationAddress1 : existing.locationAddress1;
    const building = updates.locationBuilding !== undefined ? updates.locationBuilding : existing.locationBuilding;
    const addr2 = updates.locationAddress2 !== undefined ? updates.locationAddress2 : existing.locationAddress2;
    const city = updates.locationCity !== undefined ? updates.locationCity : existing.locationCity;
    const state = updates.locationState !== undefined ? updates.locationState : existing.locationState;

    if (updates.locationAddress1 !== undefined || updates.locationBuilding !== undefined ||
        updates.locationAddress2 !== undefined || updates.locationCity !== undefined ||
        updates.locationState !== undefined) {
      const parts = [building, addr1, addr2].filter(Boolean);
      const cityState = [city, state].filter(Boolean).join(' ');
      if (cityState) parts.push(cityState);
      updates.location = parts.join('\n');
    }

    if (Object.keys(updates).length === 0) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'No fields to update' }) };
    }

    const updated = await updateEvent(chapterSlug, eventId, updates);
    logAudit('event', eventId, 'event_updated', user.userDetails, { chapterSlug, fields: Object.keys(updates) }, context);
    context.log(`Event ${eventId} updated: ${Object.keys(updates).join(', ')}`);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, updated: Object.keys(updates) })
    };
  } catch (error) {
    context.log(`updateEvent error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
