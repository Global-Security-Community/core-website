const { getAuthUser, hasRole, unauthorised, forbidden } = require('../helpers/auth');
const { getRegistrationsByEvent, updateRegistration, VALID_ROLES } = require('../helpers/tableStorage');

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
