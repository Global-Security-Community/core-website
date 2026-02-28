/**
 * Simple in-memory rate limiter for Azure Functions.
 * Note: In-memory state resets on cold starts and doesn't share across instances.
 * Sufficient for low-traffic community sites; use Table Storage for distributed limiting.
 */

const limiters = new Map();

/**
 * Check if a request is within rate limits.
 * @param {string} key - Unique identifier (IP, userId, email)
 * @param {string} action - Action name (e.g. 'register', 'apply')
 * @param {number} maxRequests - Max requests per window (default: 5)
 * @param {number} windowMs - Window in milliseconds (default: 1 hour)
 * @returns {boolean} true if allowed, false if rate limited
 */
function checkRateLimit(key, action, maxRequests = 5, windowMs = 3600000) {
  const id = `${action}:${key}`;
  const now = Date.now();

  if (!limiters.has(id)) {
    limiters.set(id, []);
  }

  const timestamps = limiters.get(id).filter(ts => now - ts < windowMs);

  if (timestamps.length >= maxRequests) {
    limiters.set(id, timestamps);
    return false;
  }

  timestamps.push(now);
  limiters.set(id, timestamps);
  return true;
}

function getClientIP(request) {
  return request.headers.get('x-forwarded-for') ||
         request.headers.get('client-ip') ||
         'unknown';
}

module.exports = { checkRateLimit, getClientIP };
