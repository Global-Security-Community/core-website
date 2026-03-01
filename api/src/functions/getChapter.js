const { getAuthUser, hasRole, unauthorised, forbidden } = require('../helpers/auth');
const { getApprovedApplicationBySlug } = require('../helpers/tableStorage');

/**
 * GET /api/getChapter?slug={slug}
 * Admin-only: get chapter details for editing.
 */
module.exports = async function (request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only chapter leads can view chapter details');

    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');

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
