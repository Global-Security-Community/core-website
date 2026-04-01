const { getApprovedApplicationsByEmail } = require('./tableStorage');

/**
 * Extracts the authenticated user from SWA's client principal header.
 * SWA injects x-ms-client-principal as a Base64-encoded JSON payload.
 *
 * Returns { userId, userDetails, userRoles, identityProvider } or null if anonymous.
 */
function getAuthUser(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;

  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8');
    const principal = JSON.parse(decoded);
    return {
      userId: principal.userId || '',
      userDetails: principal.userDetails || '',
      userRoles: (principal.userRoles || []).map(r => r.toLowerCase()),
      identityProvider: principal.identityProvider || '',
      claims: principal.claims || []
    };
  } catch {
    return null;
  }
}

/**
 * Checks if the user has a specific role.
 */
function hasRole(user, role) {
  if (!user || !user.userRoles) return false;
  return user.userRoles.includes(role.toLowerCase());
}

/**
 * Derives a chapter slug from a city name.
 * Must match the logic in chapterApproval.js and generate-chapter.yml.
 */
function cityToSlug(city) {
  return city
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Returns the list of chapter slugs that the given user email administers.
 * Based on approved chapter applications where the email is lead or second lead.
 */
async function getAdminChapterSlugs(userEmail) {
  if (!userEmail) return [];
  const apps = await getApprovedApplicationsByEmail(userEmail);
  return apps.map(app => cityToSlug(app.city)).filter(Boolean);
}

/**
 * Checks if a user email is in the SUPER_ADMIN_EMAILS env var list.
 * Super admins bypass chapter-scoped restrictions.
 */
function isSuperAdmin(userEmail) {
  const superAdmins = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return superAdmins.includes((userEmail || '').toLowerCase());
}

/**
 * Verifies the authenticated admin user has access to a specific chapter.
 * Returns true if: user is a super admin, OR user leads the target chapter.
 * Returns false otherwise.
 */
async function verifyChapterAccess(user, targetChapterSlug, context) {
  const email = (user.userDetails || '').toLowerCase();
  if (isSuperAdmin(email)) {
    return true;
  }
  const slugs = await getAdminChapterSlugs(email);
  const target = (targetChapterSlug || '').toLowerCase();
  const hasAccess = slugs.includes(target);
  if (!hasAccess && context) {
    context.log(`Chapter access denied: ${email} tried to access chapter '${target}', but only leads [${slugs.join(', ')}]`);
  }
  return hasAccess;
}

/**
 * Returns 401 JSON response.
 */
function unauthorised(message) {
  return {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message || 'Authentication required' })
  };
}

/**
 * Returns 403 JSON response.
 */
function forbidden(message) {
  return {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message || 'Insufficient permissions' })
  };
}

module.exports = { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess, getAdminChapterSlugs, isSuperAdmin, cityToSlug };
