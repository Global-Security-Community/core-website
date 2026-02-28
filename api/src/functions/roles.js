const { getAuthUser, hasRole, unauthorised, forbidden } = require('../helpers/auth');
const { getApprovedApplicationByEmail, isVolunteerForAnyEvent } = require('../helpers/tableStorage');

/**
 * POST /api/roles
 * SWA custom role assignment function.
 * Called automatically by SWA after login to assign custom roles.
 * If the user's email matches an approved chapter lead, grants 'admin' role.
 * If the user's email matches any event volunteer list, grants 'volunteer' role.
 */
module.exports = async function (request, context) {
  try {
    const body = await request.json();
    const userId = body.userId || '';
    const userDetails = body.userDetails || '';
    const claims = body.claims || [];

    // Extract email from claims (OIDC providers put it in claims array)
    const emailClaim = claims.find(c => c.typ === 'emails' || c.typ === 'email' || c.typ === 'preferred_username');
    const email = emailClaim ? emailClaim.val : userDetails;

    context.log(`Role check for userId=${userId}, userDetails=${userDetails}, email=${email}`);

    if (!userId || !email) {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: [] })
      };
    }

    const roles = [];

    // Check if this email belongs to an approved chapter lead
    const application = await getApprovedApplicationByEmail(email);
    if (application) {
      roles.push('admin');
      context.log(`Assigned admin role to ${email} (chapter lead for ${application.city})`);
    }

    // Check if this email is a volunteer for any event
    if (!application) {
      const volunteer = await isVolunteerForAnyEvent(email);
      if (volunteer) {
        roles.push('volunteer');
        context.log(`Assigned volunteer role to ${email} (event ${volunteer.partitionKey})`);
      }
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
