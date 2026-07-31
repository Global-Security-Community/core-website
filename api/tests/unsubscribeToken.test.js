describe('unsubscribe tokens', () => {
  beforeAll(() => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = 'test-unsubscribe-secret';
  });

  afterAll(() => {
    delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
  });

  test('round-trips a normalised subscription', () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = require('../src/helpers/unsubscribeToken');
    const token = generateUnsubscribeToken('Perth', 'User@Example.com');

    expect(verifyUnsubscribeToken(token)).toEqual({
      chapterSlug: 'perth',
      email: 'user@example.com'
    });
  });

  test('does not expose subscription data in the token', () => {
    const { generateUnsubscribeToken } = require('../src/helpers/unsubscribeToken');
    const token = generateUnsubscribeToken('perth', 'user@example.com');
    const decodedParts = token.split('.').slice(1)
      .map(part => Buffer.from(part, 'base64url').toString('utf8'))
      .join('');

    expect(token).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(decodedParts).not.toContain('perth');
    expect(decodedParts).not.toContain('user@example.com');
  });

  test('uses a unique encrypted token for the same subscription', () => {
    const { generateUnsubscribeToken } = require('../src/helpers/unsubscribeToken');

    expect(generateUnsubscribeToken('perth', 'user@example.com'))
      .not.toBe(generateUnsubscribeToken('perth', 'user@example.com'));
  });

  test('rejects a token that has been changed', () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = require('../src/helpers/unsubscribeToken');
    const token = generateUnsubscribeToken('perth', 'user@example.com');
    const parts = token.split('.');
    const ciphertext = Buffer.from(parts[2], 'base64url');
    ciphertext[0] ^= 1;
    parts[2] = ciphertext.toString('base64url');

    expect(verifyUnsubscribeToken(parts.join('.'))).toBeNull();
  });
});
