const crypto = require('crypto');

function getSecret() {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET || '';
  if (!secret) {
    throw new Error('EMAIL_UNSUBSCRIBE_SECRET environment variable is not configured');
  }
  return secret;
}

function normaliseSubscription(chapterSlug, email) {
  return {
    chapterSlug: String(chapterSlug || '').trim().toLowerCase(),
    email: String(email || '').trim().toLowerCase()
  };
}

function signPayload(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

function generateUnsubscribeToken(chapterSlug, email) {
  const subscription = normaliseSubscription(chapterSlug, email);
  if (!subscription.chapterSlug || !subscription.email) {
    throw new Error('Chapter slug and subscriber email are required');
  }

  const payload = Buffer.from(JSON.stringify(subscription)).toString('base64url');
  return `${payload}.${signPayload(payload)}`;
}

function verifyUnsubscribeToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [payload, signature] = parts;
  const expected = signPayload(payload);
  const providedBuffer = Buffer.from(signature, 'base64url');
  const expectedBuffer = Buffer.from(expected, 'base64url');
  if (providedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const subscription = normaliseSubscription(parsed.chapterSlug, parsed.email);
    return subscription.chapterSlug && subscription.email ? subscription : null;
  } catch {
    return null;
  }
}

module.exports = { generateUnsubscribeToken, verifyUnsubscribeToken };
