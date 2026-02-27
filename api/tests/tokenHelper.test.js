// Token helper reads APPROVAL_TOKEN_SECRET at module load time.
// We need to set it and freshly require the module.
let generateApprovalToken, verifyApprovalToken;

beforeAll(() => {
  process.env.APPROVAL_TOKEN_SECRET = 'test-secret-key-for-testing-only';
  jest.resetModules();
  const tokenHelper = require('../src/helpers/tokenHelper');
  generateApprovalToken = tokenHelper.generateApprovalToken;
  verifyApprovalToken = tokenHelper.verifyApprovalToken;
});

describe('tokenHelper', () => {
  describe('generateApprovalToken', () => {
    test('generates a token in timestamp.hmac format', () => {
      const token = generateApprovalToken('app-123', 'approve');
      expect(token).toMatch(/^\d+\.[a-f0-9]{64}$/);
    });

    test('generates different tokens for different actions', () => {
      const approve = generateApprovalToken('app-123', 'approve');
      const reject = generateApprovalToken('app-123', 'reject');
      expect(approve).not.toBe(reject);
    });

    test('generates different tokens for different IDs', () => {
      const t1 = generateApprovalToken('app-123', 'approve');
      const t2 = generateApprovalToken('app-456', 'approve');
      expect(t1).not.toBe(t2);
    });

    test('throws without secret configured', () => {
      const origSecret = process.env.APPROVAL_TOKEN_SECRET;
      process.env.APPROVAL_TOKEN_SECRET = '';
      jest.resetModules();
      const { generateApprovalToken: gen } = require('../src/helpers/tokenHelper');
      expect(() => gen('id', 'approve')).toThrow('APPROVAL_TOKEN_SECRET');
      process.env.APPROVAL_TOKEN_SECRET = origSecret;
      jest.resetModules();
    });
  });

  describe('verifyApprovalToken', () => {
    test('verifies a valid token', () => {
      const token = generateApprovalToken('app-123', 'approve');
      expect(verifyApprovalToken('app-123', 'approve', token)).toBe(true);
    });

    test('rejects token with wrong action', () => {
      const token = generateApprovalToken('app-123', 'approve');
      expect(verifyApprovalToken('app-123', 'reject', token)).toBe(false);
    });

    test('rejects token with wrong ID', () => {
      const token = generateApprovalToken('app-123', 'approve');
      expect(verifyApprovalToken('app-999', 'approve', token)).toBe(false);
    });

    test('rejects tampered token', () => {
      const token = generateApprovalToken('app-123', 'approve');
      const tampered = token.replace(/.$/, 'x');
      expect(verifyApprovalToken('app-123', 'approve', tampered)).toBe(false);
    });

    test('rejects null/empty token', () => {
      expect(verifyApprovalToken('app-123', 'approve', null)).toBe(false);
      expect(verifyApprovalToken('app-123', 'approve', '')).toBe(false);
    });

    test('rejects token without dot separator', () => {
      expect(verifyApprovalToken('app-123', 'approve', 'nodotshere')).toBe(false);
    });

    test('rejects expired token (>7 days old)', () => {
      const crypto = require('crypto');
      const oldTimestamp = (Date.now() - 8 * 24 * 60 * 60 * 1000).toString();
      const data = `app-123:approve:${oldTimestamp}`;
      const hmac = crypto.createHmac('sha256', process.env.APPROVAL_TOKEN_SECRET).update(data).digest('hex');
      const expiredToken = `${oldTimestamp}.${hmac}`;
      expect(verifyApprovalToken('app-123', 'approve', expiredToken)).toBe(false);
    });

    test('accepts token within 7 days', () => {
      const crypto = require('crypto');
      const recentTimestamp = (Date.now() - 6 * 24 * 60 * 60 * 1000).toString();
      const data = `app-123:approve:${recentTimestamp}`;
      const hmac = crypto.createHmac('sha256', process.env.APPROVAL_TOKEN_SECRET).update(data).digest('hex');
      const validToken = `${recentTimestamp}.${hmac}`;
      expect(verifyApprovalToken('app-123', 'approve', validToken)).toBe(true);
    });
  });
});
