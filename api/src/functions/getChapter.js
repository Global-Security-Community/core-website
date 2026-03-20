const { getAuthUser, hasRole, unauthorised, forbidden } = require('../helpers/auth');
const { getApprovedApplicationBySlug, getApprovedApplicationByEmail } = require('../helpers/tableStorage');

/**
 * GET /api/getChapter?slug={slug}
 * Admin-only: get chapter details for editing.
 *
 * GET /api/getChapter?mine=true
 * Admin-only: get the chapter the current user leads (by email lookup).
 */
module.exports = async function (request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only chapter leads can view chapter details');

    const url = new URL(request.url);
    let slug = url.searchParams.get('slug');
    const mine = url.searchParams.get('mine');

    // If ?mine=true, look up the user's chapter by email
    if (mine === 'true' && !slug) {
      const emailClaims = ['preferred_username', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', 'email', 'emails'];
      let adminEmail = '';
      for (const ct of emailClaims) {
        const claim = (user.claims || []).find(c => c.typ === ct);
        if (claim && claim.val && claim.val.includes('@')) { adminEmail = claim.val; break; }
      }
      if (!adminEmail) adminEmail = user.userDetails || '';

      if (!adminEmail) {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Could not determine your email address' }) };
      }

      const app = await getApprovedApplicationByEmail(adminEmail);
      if (!app) {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'No approved chapter found for your account' }) };
      }

      slug = (app.city || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
    }

    if (!slug) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing slug parameter' }) };
    }

    const application = await getApprovedApplicationBySlug(slug);
    if (!application) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'No approved chapter found' }) };
    }

    // If leads have been edited, use the JSON; otherwise build from original application fields
    let leads;
    if (application.leadsJson) {
      try {
        leads = JSON.parse(application.leadsJson);
      } catch {
        leads = null;
      }
    }

    if (!leads) {
      leads = [{
        name: application.fullName || '',
        email: application.email || '',
        github: application.github || '',
        linkedin: application.linkedIn || '',
        twitter: '',
        website: ''
      }];
      if (application.secondLeadName) {
        leads.push({
          name: application.secondLeadName || '',
          email: application.secondLeadEmail || '',
          github: application.secondLeadGitHub || '',
          linkedin: application.secondLeadLinkedIn || '',
          twitter: '',
          website: ''
        });
      }
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: application.city,
        country: application.country,
        slug,
        leads
      })
    };
  } catch (error) {
    context.log(`getChapter error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
