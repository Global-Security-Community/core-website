const mockBeginSend = jest.fn();
const mockPollUntilDone = jest.fn().mockResolvedValue({ status: 'Succeeded' });

jest.mock('@azure/communication-email', () => ({
  EmailClient: jest.fn().mockImplementation(() => ({ beginSend: mockBeginSend }))
}));

describe('superadmin email notifications', () => {
  let emailService;
  const context = { log: jest.fn() };

  beforeAll(() => {
    process.env.AZURE_COMMUNICATION_CONNECTION_STRING = 'endpoint=https://test/;accesskey=test';
    emailService = require('../src/helpers/emailService');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPER_ADMIN_EMAILS = ' First@Example.com,second@example.com,first@example.com ';
    mockBeginSend.mockResolvedValue({ pollUntilDone: mockPollUntilDone });
    mockPollUntilDone.mockResolvedValue({ status: 'Succeeded' });
  });

  afterAll(() => {
    delete process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
    delete process.env.SUPER_ADMIN_EMAILS;
  });

  test('emails each unique superadmin privately and escapes chapter application content', async () => {
    await emailService.sendChapterApplicationAdminEmail({
      fullName: '<script>alert(1)</script>',
      email: 'applicant@example.com',
      city: 'Perth',
      country: 'Australia',
      whyLead: '<b>Build a community</b>',
      existingCommunity: '',
      secondLeadName: '',
      secondLeadEmail: ''
    }, context);

    expect(mockBeginSend).toHaveBeenCalledTimes(2);
    expect(mockBeginSend.mock.calls.map(call => call[0].recipients.to[0].address)).toEqual([
      'first@example.com',
      'second@example.com'
    ]);
    mockBeginSend.mock.calls.forEach(call => {
      expect(call[0].recipients.to).toHaveLength(1);
      expect(call[0].content.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(call[0].content.html).toContain('&lt;b&gt;Build a community&lt;/b&gt;');
      expect(call[0].content.html).not.toContain('<script>');
    });
  });

  test('escapes contact message content and strips newlines from the email subject', async () => {
    await emailService.sendContactSubmissionAdminEmail({
      name: 'Alice',
      email: 'alice@example.com',
      subject: 'Hello\r\nBCC: victim@example.com',
      message: '<img src=x onerror=alert(1)>'
    }, context);

    const message = mockBeginSend.mock.calls[0][0];
    expect(message.content.subject).toBe('New contact request: Hello BCC: victim@example.com');
    expect(message.content.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(message.content.html).not.toContain('<img src=x');
  });

  test('does nothing when no superadmin recipients are configured', async () => {
    delete process.env.SUPER_ADMIN_EMAILS;

    const results = await emailService.sendContactSubmissionAdminEmail({
      name: 'Alice',
      email: 'alice@example.com',
      subject: 'Hello',
      message: 'Test'
    }, context);

    expect(results).toEqual([]);
    expect(mockBeginSend).not.toHaveBeenCalled();
  });
});
