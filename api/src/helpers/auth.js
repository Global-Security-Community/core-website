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
      identityProvider: principal.identityProvider || ''
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

module.exports = { getAuthUser, hasRole, unauthorised, forbidden };
