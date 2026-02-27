const { getAuthUser, hasRole, unauthorised, forbidden } = require('../helpers/auth');
const { getApprovedApplicationByEmail } = require('../helpers/tableStorage');

/**
 * POST /api/roles
 * SWA custom role assignment function.
 * Called automatically by SWA after login to assign custom roles.
 * If the user's email matches an approved chapter lead, grants 'admin' role.
 */
module.exports = async function (request, context) {
  try {
    const body = await request.json();
    const userId = body.userId || '';
    const userDetails = body.userDetails || ''; // email for most providers

    if (!userId || !userDetails) {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: [] })
      };
    }

    // Check if this email belongs to an approved chapter lead
    const application = await getApprovedApplicationByEmail(userDetails);

    const roles = [];
    if (application) {
      roles.push('admin');
      context.log(`Assigned admin role to ${userDetails} (chapter lead for ${application.city})`);
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles })
    };
  } catch (error) {
    context.log(`Role assignment error: ${error.message}`);
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles: [] })
    };
  }
};
