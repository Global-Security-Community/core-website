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
  // Lazy-load to avoid pulling in @azure/data-tables at module level (breaks tests on Node 18)
  const { getApprovedApplicationsByEmail } = require('./tableStorage');
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
 * Extracts the user's email from the SWA principal.
 * Tries claims first (multiple OIDC formats), falls back to userDetails.
 */
function extractEmail(user) {
  const claims = user.claims || [];
  const emailClaimTypes = [
    'emails', 'email', 'preferred_username',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
  ];
  for (const typ of emailClaimTypes) {
    const claim = claims.find(c => c.typ === typ);
    if (claim && claim.val) {
      // Handle JSON array values (e.g. B2C 'emails' claim: '["user@example.com"]')
      let val = claim.val;
      if (val.startsWith('[')) {
        try { val = JSON.parse(val)[0] || ''; } catch { /* not JSON */ }
      }
      if (val.includes('@')) return val.toLowerCase();
    }
  }
  // Fallback to userDetails if it looks like an email
  const details = (user.userDetails || '');
  if (details.includes('@')) return details.toLowerCase();
  return '';
}

/**
 * Async version of extractEmail that falls back to the UserEmails table.
 * SWA custom OIDC does not include claims in x-ms-client-principal header,
 * so this looks up the cached email stored during role assignment at login.
 */
async function resolveEmail(user) {
  const email = extractEmail(user);
  if (email) return email;
  if (user.userId) {
    const { getUserEmail } = require('./tableStorage');
    return getUserEmail(user.userId);
  }
  return '';
}

/**
 * Verifies the authenticated admin user has access to a specific chapter.
 * Returns true if: user is a super admin, OR user leads the target chapter.
 * Returns false otherwise.
 */
async function verifyChapterAccess(user, targetChapterSlug, context) {
  const email = await resolveEmail(user);
  if (isSuperAdmin(email)) {
    return true;
  }
  const slugs = await getAdminChapterSlugs(email);
  const target = (targetChapterSlug || '').toLowerCase();
  const hasAccess = slugs.includes(target);
  if (!hasAccess && context) {
    const { logSecurityEvent } = require('./securityLogger');
    logSecurityEvent(context, 'chapter_access_denied', {
      email, targetChapter: target, userChapters: slugs
    });
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

/**
 * Verifies the presence of a custom CSRF header on POST requests.
 * Requests from the app's own fetch() calls include X-Requested-With.
 * SWA roles endpoint and other platform calls are excluded.
 * Returns null if OK, or a 403 response object if the check fails.
 */
function verifyCsrfHeader(request) {
  if (request.method !== 'POST') return null;
  const xrw = request.headers.get('x-requested-with');
  if (xrw === 'fetch') return null;
  return {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Missing CSRF header' })
  };
}

module.exports = { getAuthUser, hasRole, unauthorised, forbidden, verifyChapterAccess, getAdminChapterSlugs, isSuperAdmin, cityToSlug, verifyCsrfHeader, extractEmail, resolveEmail };
