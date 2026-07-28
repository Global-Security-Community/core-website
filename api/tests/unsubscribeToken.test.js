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

  test('rejects a token that has been changed', () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = require('../src/helpers/unsubscribeToken');
    const token = generateUnsubscribeToken('perth', 'user@example.com');
    const [payload, signature] = token.split('.');

    expect(verifyUnsubscribeToken(`${payload}.${signature.slice(0, -1)}A`)).toBeNull();
  });
});
