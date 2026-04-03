const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '';
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Production';

/**
 * Verifies a Cloudflare Turnstile token server-side.
 * Returns true if valid, false if invalid or not configured.
 * In production, fails closed (returns false) when secret key is missing.
 * In development, skips verification when secret key is not set.
 */
async function verifyTurnstileToken(token, remoteIp, context) {
  if (!TURNSTILE_SECRET_KEY) {
    if (IS_PRODUCTION) {
      context.log('WARNING: TURNSTILE_SECRET_KEY not set in production — rejecting request');
      return false;
    }
    context.log('TURNSTILE_SECRET_KEY not set — skipping verification (dev mode)');
    return true;
  }

  if (!token) {
    context.log('No Turnstile token provided');
    return false;
  }

  try {
    const body = new URLSearchParams({
      secret: TURNSTILE_SECRET_KEY,
      response: token,
      ...(remoteIp ? { remoteip: remoteIp } : {})
    });

    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const result = await response.json();

    if (!result.success) {
      context.log(`Turnstile verification failed: ${JSON.stringify(result['error-codes'] || [])}`);
    }

    return result.success === true;
  } catch (err) {
    context.log(`Turnstile verification error: ${err.message}`);
    return false;
  }
}

module.exports = { verifyTurnstileToken };
