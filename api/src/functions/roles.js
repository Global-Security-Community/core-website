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

    // Extract email from claims - try multiple claim types used by different OIDC providers
    const emailClaimTypes = [
      'emails',
      'email', 
      'preferred_username',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
    ];
    let email = '';
    for (const typ of emailClaimTypes) {
      const claim = claims.find(c => c.typ === typ);
      if (claim && claim.val && claim.val.includes('@')) {
        email = claim.val;
        break;
      }
    }
    // Fallback to userDetails if it looks like an email
    if (!email && userDetails && userDetails.includes('@')) {
      email = userDetails;
    }

    context.log(`Role check: userId=${userId}, userDetails=${userDetails}, email=${email}, claimTypes=${claims.map(c => c.typ).join(',')}, claimVals=${claims.map(c => c.typ + '=' + c.val).join(' | ')}`);

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
