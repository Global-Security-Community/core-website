const { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess } = require('../helpers/auth');
const { getRegistrationsByEvent, updateRegistration, getEventById, VALID_ROLES } = require('../helpers/tableStorage');
const { logAudit } = require('../helpers/auditLog');

/**
 * POST /api/updateRegistrationRole
 * Admin-only: update the role of one or more registrations.
 */
module.exports = async function (request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only chapter leads can update roles');

    let body;
    try { body = await request.json(); } catch {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { eventId, registrationIds, role } = body;

    if (!eventId || !registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0 || !role) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing eventId, registrationIds (array), or role' }) };
    }

    if (!VALID_ROLES.includes(role)) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }) };
    }

    // Verify admin has access to this event's chapter
    const event = await getEventById(eventId);
    if (event) {
      const chapterSlug = event.chapterSlug || event.partitionKey || '';
      if (!await verifyChapterAccess(user, chapterSlug, context)) {
        return forbidden('You do not have permission to manage registrations for this event');
      }
    }

    const registrations = await getRegistrationsByEvent(eventId);
    const regMap = {};
    registrations.forEach(r => { regMap[r.rowKey] = r; });

    let updated = 0;
    const errors = [];

    for (const regId of registrationIds) {
      if (!regMap[regId]) {
        errors.push({ id: regId, error: 'Registration not found' });
        continue;
      }
      try {
        await updateRegistration(eventId, regId, { role });
        updated++;
      } catch (err) {
        errors.push({ id: regId, error: err.message });
      }
    }

    context.log(`Updated ${updated} registration roles to '${role}' for event ${eventId} by ${user.userDetails}`);
    logAudit('event', eventId, 'registration_role_updated', user.userDetails, { role, count: updated, registrationIds }, context);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, updated, errors: errors.length > 0 ? errors : undefined })
    };
  } catch (error) {
    context.log(`updateRegistrationRole error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
