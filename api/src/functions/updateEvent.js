const { getAuthUser, hasRole, unauthorised, forbidden } = require('../helpers/auth');
const { updateEvent, getEvent } = require('../helpers/tableStorage');
const { sanitiseFields } = require('../helpers/sanitise');

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
