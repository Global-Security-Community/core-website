const crypto = require('crypto');

const APPROVAL_TOKEN_SECRET = process.env.APPROVAL_TOKEN_SECRET || '';

function generateApprovalToken(applicationId, action) {
  if (!APPROVAL_TOKEN_SECRET) {
    throw new Error('APPROVAL_TOKEN_SECRET environment variable is not configured');
  }
  const data = `${applicationId}:${action}`;
  return crypto.createHmac('sha256', APPROVAL_TOKEN_SECRET).update(data).digest('hex');
}

function verifyApprovalToken(applicationId, action, token) {
  const expectedToken = generateApprovalToken(applicationId, action);
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
}

module.exports = { generateApprovalToken, verifyApprovalToken };
