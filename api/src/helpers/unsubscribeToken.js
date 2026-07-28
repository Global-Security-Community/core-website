const crypto = require('crypto');

const TOKEN_VERSION = 'v1';
const IV_LENGTH = 12;

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

function encryptionKey() {
  return crypto.createHash('sha256').update(getSecret(), 'utf8').digest();
}

function generateUnsubscribeToken(chapterSlug, email) {
  const subscription = normaliseSubscription(chapterSlug, email);
  if (!subscription.chapterSlug || !subscription.email) {
    throw new Error('Chapter slug and subscriber email are required');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(subscription), 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return [
    TOKEN_VERSION,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    authTag.toString('base64url')
  ].join('.');
}

function verifyUnsubscribeToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 4 || parts.some(part => !part) || parts[0] !== TOKEN_VERSION) {
    return null;
  }

  const [, encodedIv, encodedCiphertext, encodedAuthTag] = parts;
  const iv = Buffer.from(encodedIv, 'base64url');
  const ciphertext = Buffer.from(encodedCiphertext, 'base64url');
  const authTag = Buffer.from(encodedAuthTag, 'base64url');
  if (iv.length !== IV_LENGTH || !ciphertext.length || authTag.length !== 16) return null;

  const key = encryptionKey();
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]).toString('utf8');
    const parsed = JSON.parse(plaintext);
    const subscription = normaliseSubscription(parsed.chapterSlug, parsed.email);
    return subscription.chapterSlug && subscription.email ? subscription : null;
  } catch {
    return null;
  }
}

module.exports = { generateUnsubscribeToken, verifyUnsubscribeToken };
