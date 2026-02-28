const { app } = require('@azure/functions');
const { getAuthUser, unauthorised } = require('../helpers/auth');
const { getRegistrationsByUser, deleteRegistration, deleteDemographics } = require('../helpers/tableStorage');

/**
 * POST /api/cancelRegistration
 * Authenticated users cancel their own event registration.
 */
async function cancelRegistration(request, context) {
  context.log('Cancel registration request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();

    let body;
    try { body = await request.json(); } catch {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { registrationId } = body;
    if (!registrationId) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing required field: registrationId' }) };
    }

    // Find the user's registration to verify ownership
    const userRegs = await getRegistrationsByUser(user.userId);
    const reg = userRegs.find(r => r.rowKey === registrationId);

    if (!reg) {
      return { status: 404, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Registration not found' }) };
    }

    // Don't allow cancellation if already checked in
    if (reg.checkedIn) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Cannot cancel — you have already checked in to this event' }) };
    }

    // Delete registration and demographics
    await deleteRegistration(reg.partitionKey, reg.rowKey);
    await deleteDemographics(reg.partitionKey, reg.rowKey);

    context.log(`Registration ${registrationId} cancelled by user ${user.userId}`);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Registration cancelled successfully' })
    };
  } catch (error) {
    context.log(`cancelRegistration error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
}

app.http('cancelRegistration', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'cancelRegistration',
  handler: cancelRegistration
});

module.exports = cancelRegistration;
