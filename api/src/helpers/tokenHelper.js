const crypto = require('crypto');

const APPROVAL_TOKEN_SECRET = process.env.APPROVAL_TOKEN_SECRET || '';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateApprovalToken(applicationId, action) {
  if (!APPROVAL_TOKEN_SECRET) {
    throw new Error('APPROVAL_TOKEN_SECRET environment variable is not configured');
  }
  const timestamp = Date.now().toString();
  const data = `${applicationId}:${action}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', APPROVAL_TOKEN_SECRET).update(data).digest('hex');
  return `${timestamp}.${hmac}`;
}

function verifyApprovalToken(applicationId, action, token) {
  if (!token || !token.includes('.')) return false;
  const [timestamp, hmac] = token.split('.', 2);
  if (!timestamp || !hmac) return false;

  // Check token age
  const tokenAge = Date.now() - parseInt(timestamp, 10);
  if (isNaN(tokenAge) || tokenAge > TOKEN_TTL_MS) return false;

  const data = `${applicationId}:${action}:${timestamp}`;
  const expectedHmac = crypto.createHmac('sha256', APPROVAL_TOKEN_SECRET).update(data).digest('hex');
  if (hmac.length !== expectedHmac.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
}

module.exports = { generateApprovalToken, verifyApprovalToken };
