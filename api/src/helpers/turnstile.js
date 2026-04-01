const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '';
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Cloudflare Turnstile token server-side.
 * Returns true if valid, false if invalid or not configured.
 */
async function verifyTurnstileToken(token, remoteIp, context) {
  if (!TURNSTILE_SECRET_KEY) {
    context.log('TURNSTILE_SECRET_KEY not set — skipping verification');
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
