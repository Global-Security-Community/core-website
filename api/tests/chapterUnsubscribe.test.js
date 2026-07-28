const mockRemoveSubscription = jest.fn().mockResolvedValue({});
const mockVerifyUnsubscribeToken = jest.fn();

jest.mock('../src/helpers/tableStorage', () => ({ removeSubscription: mockRemoveSubscription }));
jest.mock('../src/helpers/unsubscribeToken', () => ({ verifyUnsubscribeToken: mockVerifyUnsubscribeToken }));

const chapterUnsubscribe = require('../src/functions/chapterUnsubscribe');

describe('chapterUnsubscribe function', () => {
  const context = { log: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyUnsubscribeToken.mockReturnValue({
      chapterSlug: 'perth',
      email: 'user@example.com'
    });
  });

  test('shows a confirmation page without changing the subscription on GET', async () => {
    const response = await chapterUnsubscribe({
      method: 'GET',
      url: 'https://globalsecurity.community/api/chapterUnsubscribe?token=valid'
    }, context);

    expect(response.status).toBe(200);
    expect(response.body).toContain('Confirm that you no longer want');
    expect(mockRemoveSubscription).not.toHaveBeenCalled();
  });

  test('removes the subscription for a valid one-click POST', async () => {
    const response = await chapterUnsubscribe({
      method: 'POST',
      url: 'https://globalsecurity.community/api/chapterUnsubscribe?token=valid',
      text: jest.fn().mockResolvedValue('List-Unsubscribe=One-Click')
    }, context);

    expect(response.status).toBe(200);
    expect(mockRemoveSubscription).toHaveBeenCalledWith('perth', 'user@example.com');
    expect(response.body).toContain('You have been unsubscribed');
  });

  test('rejects invalid tokens', async () => {
    mockVerifyUnsubscribeToken.mockReturnValue(null);

    const response = await chapterUnsubscribe({
      method: 'POST',
      url: 'https://globalsecurity.community/api/chapterUnsubscribe?token=invalid',
      text: jest.fn().mockResolvedValue('List-Unsubscribe=One-Click')
    }, context);

    expect(response.status).toBe(400);
    expect(mockRemoveSubscription).not.toHaveBeenCalled();
  });

  test('rejects non-standard POST bodies', async () => {
    const response = await chapterUnsubscribe({
      method: 'POST',
      url: 'https://globalsecurity.community/api/chapterUnsubscribe?token=valid',
      text: jest.fn().mockResolvedValue('confirm=yes')
    }, context);

    expect(response.status).toBe(400);
    expect(mockRemoveSubscription).not.toHaveBeenCalled();
  });
});
