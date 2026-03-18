/**
 * Tests for previously untested API functions.
 * Covers: contactForm, chapterApplication, chapterApproval, registerEvent,
 * cancelRegistration, createEvent, issueBadges, eventAttendance, badgeDownload
 */

// Set env vars before requiring modules
process.env.DISCORD_CONTACT_CHANNEL_ID = 'test-contact-channel';
process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID = 'test-notif-channel';
process.env.MAX_REQUESTS_PER_WINDOW = '3'; // Lower limit for faster rate-limit testing

jest.mock('@azure/functions', () => ({
  app: { http: jest.fn(), post: jest.fn(), get: jest.fn() }
}));

jest.mock('../src/helpers/tableStorage', () => ({
  storeApplication: jest.fn().mockResolvedValue({}),
  getApplication: jest.fn(),
  updateApplicationStatus: jest.fn().mockResolvedValue({}),
  storeEvent: jest.fn().mockResolvedValue({}),
  getEvent: jest.fn(),
  getEventById: jest.fn(),
  getEventBySlug: jest.fn(),
  listEvents: jest.fn().mockResolvedValue([]),
  updateEvent: jest.fn().mockResolvedValue({ status: 'closed' }),
  storeRegistration: jest.fn().mockResolvedValue({}),
  getRegistrationByTicketCode: jest.fn(),
  getRegistrationsByUser: jest.fn().mockResolvedValue([]),
  getRegistrationsByEvent: jest.fn().mockResolvedValue([]),
  countRegistrations: jest.fn().mockResolvedValue(0),
  updateRegistration: jest.fn().mockResolvedValue({}),
  deleteRegistration: jest.fn().mockResolvedValue({}),
  storeDemographics: jest.fn().mockResolvedValue({}),
  deleteDemographics: jest.fn().mockResolvedValue({}),
  storeBadge: jest.fn().mockResolvedValue({}),
  getBadge: jest.fn(),
  getBadgesByEvent: jest.fn().mockResolvedValue([]),
  getRegistrationsByRole: jest.fn().mockResolvedValue([]),
  isVolunteerOrOrganiserByRegistration: jest.fn().mockResolvedValue(null),
  isVolunteerForAnyEvent: jest.fn().mockResolvedValue(null),
  VALID_ROLES: ['attendee', 'volunteer', 'speaker', 'sponsor', 'organiser'],
  getApprovedApplicationByEmail: jest.fn(),
  getApprovedApplicationBySlug: jest.fn(),
  storeSessionizeCache: jest.fn().mockResolvedValue({}),
  getSessionizeCache: jest.fn(),
  storeSubscription: jest.fn().mockResolvedValue({}),
  removeSubscription: jest.fn().mockResolvedValue({}),
  getSubscriptionsByChapter: jest.fn().mockResolvedValue([]),
  isSubscribed: jest.fn().mockResolvedValue(false),
  storePartner: jest.fn().mockResolvedValue({}),
  deletePartner: jest.fn().mockResolvedValue({}),
  getPartnersByEvent: jest.fn().mockResolvedValue([]),
  getPartnersByChapter: jest.fn().mockResolvedValue([])
}));

jest.mock('../src/helpers/discordBot', () => ({
  sendMessage: jest.fn().mockResolvedValue(true),
  createChapterChannel: jest.fn().mockResolvedValue({ channelId: '123', channelName: 'test' })
}));

jest.mock('../src/helpers/emailService', () => ({
  sendTicketEmail: jest.fn().mockResolvedValue({}),
  sendBadgeEmail: jest.fn().mockResolvedValue({}),
  sendCancellationEmail: jest.fn().mockResolvedValue({}),
  sendEventNotificationEmail: jest.fn().mockResolvedValue({})
}));

jest.mock('../src/helpers/rateLimiter', () => ({
  checkRateLimit: jest.fn().mockReturnValue(true),
  getClientIP: jest.fn().mockReturnValue('127.0.0.1')
}));

jest.mock('../src/helpers/tokenHelper', () => ({
  generateApprovalToken: jest.fn().mockReturnValue('mock-token'),
  verifyApprovalToken: jest.fn().mockReturnValue(true)
}));

jest.mock('../src/helpers/badgeGenerator', () => ({
  generateBadge: jest.fn().mockReturnValue('<svg>mock</svg>'),
  generateBadgePng: jest.fn().mockResolvedValue(Buffer.from('mock-png')),
  generateTextOverlay: jest.fn().mockReturnValue('<svg>overlay</svg>')
}));

jest.mock('../src/helpers/imageGenerator', () => ({
  generateChapterBanner: jest.fn().mockResolvedValue('https://gsccoresa.blob.core.windows.net/generated-images/chapters/test.png'),
  generateEventBadgeBackground: jest.fn().mockResolvedValue('https://gsccoresa.blob.core.windows.net/generated-images/events/test.png'),
  callFluxApi: jest.fn().mockResolvedValue(Buffer.from('mock')),
  uploadToBlob: jest.fn().mockResolvedValue('https://mock.blob.url/test.png')
}));

jest.mock('@azure/data-tables', () => ({
  TableClient: { fromConnectionString: jest.fn().mockReturnValue({ updateEntity: jest.fn().mockResolvedValue({}) }) }
}));

jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: { fromConnectionString: jest.fn().mockReturnValue({
    getContainerClient: jest.fn().mockReturnValue({
      createIfNotExists: jest.fn().mockResolvedValue({}),
      getBlockBlobClient: jest.fn().mockReturnValue({
        uploadData: jest.fn().mockResolvedValue({}),
        url: 'https://mock.blob.url/test.png'
      })
    })
  })}
}));

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    repos: {
      createDispatchEvent: jest.fn().mockResolvedValue({}),
      getContent: jest.fn().mockResolvedValue({ data: { sha: 'abc123' } }),
      createOrUpdateFileContents: jest.fn().mockResolvedValue({})
    }
  }))
}));

jest.mock('@octokit/auth-app', () => ({ createAppAuth: jest.fn() }));

jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockQR') }));

const storage = require('../src/helpers/tableStorage');
const discord = require('../src/helpers/discordBot');
const emailService = require('../src/helpers/emailService');
const rateLimiter = require('../src/helpers/rateLimiter');
const tokenHelper = require('../src/helpers/tokenHelper');
const badgeGen = require('../src/helpers/badgeGenerator');

function makeRequest(method, body, headers) {
  return {
    method,
    url: 'https://globalsecurity.community/api/test',
    headers: { get: (h) => (headers || {})[h] || null },
    json: () => Promise.resolve(body || {})
  };
}

function makeAuthRequest(method, body, roles) {
  const principal = {
    userId: 'test-user-123',
    userDetails: 'test@example.com',
    userRoles: roles || ['authenticated'],
    identityProvider: 'ciam'
  };
  const encoded = Buffer.from(JSON.stringify(principal)).toString('base64');
  return {
    method,
    url: 'https://globalsecurity.community/api/test',
    headers: { get: (h) => h === 'x-ms-client-principal' ? encoded : null },
    json: () => Promise.resolve(body || {})
  };
}

const context = { log: jest.fn() };

// ─── contactForm ────────────────────────────────────────────────────

describe('contactForm function', () => {
  const contactForm = require('../src/functions/contactForm');
  let ipCounter = 0;

  // Each test gets a unique IP to avoid internal rate-limit interference
  function contactRequest(body) {
    ipCounter++;
    return {
      method: 'POST',
      url: 'https://globalsecurity.community/api/contactForm',
      headers: { get: (h) => h === 'x-forwarded-for' ? `10.0.0.${ipCounter}` : null },
      json: () => Promise.resolve(body || {})
    };
  }

  beforeEach(() => jest.clearAllMocks());

  test('returns 405 for non-POST requests', async () => {
    const req = { ...contactRequest({}), method: 'GET' };
    const res = await contactForm(req, context);
    expect(res.status).toBe(405);
  });

  test('returns 400 for missing required fields', async () => {
    const res = await contactForm(contactRequest({ name: 'Alice' }), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Missing required/);
  });

  test('returns 400 for invalid email format', async () => {
    const res = await contactForm(contactRequest({
      name: 'Alice', email: 'not-an-email', subject: 'Test', message: 'Hello'
    }), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Invalid email/);
  });

  test('returns 400 for field length exceeded', async () => {
    const res = await contactForm(contactRequest({
      name: 'A'.repeat(101), email: 'test@test.com', subject: 'Test', message: 'Hello'
    }), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/length/);
  });

  test('returns 500 when Discord channel not configured', async () => {
    const saved = process.env.DISCORD_CONTACT_CHANNEL_ID;
    delete process.env.DISCORD_CONTACT_CHANNEL_ID;
    // Need to re-require to pick up missing env var — but module is cached.
    // Instead, the function reads env at runtime, so deleting it works.
    const res = await contactForm(contactRequest({
      name: 'Alice', email: 'alice@test.com', subject: 'Test', message: 'Hello'
    }), context);
    expect(res.status).toBe(500);
    process.env.DISCORD_CONTACT_CHANNEL_ID = saved;
  });

  test('returns 500 when Discord send fails', async () => {
    discord.sendMessage.mockResolvedValueOnce(false);
    const res = await contactForm(contactRequest({
      name: 'Alice', email: 'alice@test.com', subject: 'Test', message: 'Hello'
    }), context);
    expect(res.status).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/Failed to send/);
  });

  test('returns 200 on successful submission', async () => {
    const res = await contactForm(contactRequest({
      name: 'Alice', email: 'alice@test.com', subject: 'Test', message: 'Hello world'
    }), context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
    expect(discord.sendMessage).toHaveBeenCalledWith('test-contact-channel', expect.any(Object), context);
  });

  test('rate limits after too many requests from same IP', async () => {
    // MAX_REQUESTS_PER_WINDOW is set to 3 for this test file
    const ip = '10.99.99.99';
    function sameIpReq() {
      return {
        method: 'POST',
        url: 'https://globalsecurity.community/api/contactForm',
        headers: { get: (h) => h === 'x-forwarded-for' ? ip : null },
        json: () => Promise.resolve({ name: 'A', email: 'a@a.com', subject: 'S', message: 'M' })
      };
    }
    // First 3 should succeed
    for (let i = 0; i < 3; i++) {
      await contactForm(sameIpReq(), context);
    }
    // 4th should be rate limited
    const res = await contactForm(sameIpReq(), context);
    expect(res.status).toBe(429);
  });
});

// ─── chapterApplication ─────────────────────────────────────────────

describe('chapterApplication function', () => {
  const chapterApplication = require('../src/functions/chapterApplication');

  beforeEach(() => jest.clearAllMocks());

  const validBody = {
    fullName: 'Alice Smith', email: 'alice@test.com', city: 'Perth',
    country: 'Australia', whyLead: 'I love cybersecurity'
  };

  test('returns 429 when rate limited', async () => {
    rateLimiter.checkRateLimit.mockReturnValueOnce(false);
    const res = await chapterApplication(makeRequest('POST', validBody), context);
    expect(res.status).toBe(429);
  });

  test('returns 200 silently when honeypot triggered', async () => {
    const res = await chapterApplication(makeRequest('POST', { ...validBody, website: 'spam.com' }), context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
    // Should NOT store the application
    expect(storage.storeApplication).not.toHaveBeenCalled();
  });

  test('returns 400 for missing required fields', async () => {
    const res = await chapterApplication(makeRequest('POST', { fullName: 'Alice' }), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/required fields/);
  });

  test('returns 400 for field length exceeded', async () => {
    const res = await chapterApplication(makeRequest('POST', {
      ...validBody, fullName: 'A'.repeat(101)
    }), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/length/);
  });

  test('returns 400 for invalid email', async () => {
    const res = await chapterApplication(makeRequest('POST', {
      ...validBody, email: 'bad-email'
    }), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/valid email/);
  });

  test('returns 400 for invalid LinkedIn URL', async () => {
    const res = await chapterApplication(makeRequest('POST', {
      ...validBody, linkedIn: 'https://twitter.com/alice'
    }), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/LinkedIn URL/);
  });

  test('returns 400 for invalid GitHub URL', async () => {
    const res = await chapterApplication(makeRequest('POST', {
      ...validBody, github: 'https://gitlab.com/alice'
    }), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/GitHub URL/);
  });

  test('returns 400 for invalid second lead email', async () => {
    const res = await chapterApplication(makeRequest('POST', {
      ...validBody, secondLeadName: 'Bob', secondLeadEmail: 'not-valid'
    }), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/second lead/);
  });

  test('stores application and sends Discord notification on success', async () => {
    const res = await chapterApplication(makeRequest('POST', {
      ...validBody, linkedIn: 'https://linkedin.com/in/alice', github: 'https://github.com/alice'
    }), context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
    expect(storage.storeApplication).toHaveBeenCalledTimes(1);
    expect(discord.sendMessage).toHaveBeenCalledWith('test-notif-channel', expect.any(Object), context);
  });
});

// ─── chapterApproval ────────────────────────────────────────────────

describe('chapterApproval function', () => {
  const chapterApproval = require('../src/functions/chapterApproval');

  beforeEach(() => jest.clearAllMocks());

  function approvalReq(params) {
    const qs = new URLSearchParams(params).toString();
    return {
      method: 'GET',
      url: `https://globalsecurity.community/api/chapterApproval?${qs}`,
      headers: { get: () => null },
      json: () => Promise.resolve({})
    };
  }

  test('returns 400 for missing parameters', async () => {
    const res = await chapterApproval(approvalReq({}), context);
    expect(res.status).toBe(400);
    expect(res.body).toContain('Missing Parameters');
  });

  test('returns 400 for invalid action', async () => {
    const res = await chapterApproval(approvalReq({ id: 'app-1', action: 'delete', token: 'tok' }), context);
    expect(res.status).toBe(400);
    expect(res.body).toContain('Invalid Action');
  });

  test('returns 403 for invalid token', async () => {
    tokenHelper.verifyApprovalToken.mockReturnValueOnce(false);
    const res = await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'bad' }), context);
    expect(res.status).toBe(403);
    expect(res.body).toContain('Invalid Token');
  });

  test('returns 403 when token verification throws', async () => {
    tokenHelper.verifyApprovalToken.mockImplementationOnce(() => { throw new Error('expired'); });
    const res = await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'exp' }), context);
    expect(res.status).toBe(403);
  });

  test('returns 404 when application not found', async () => {
    storage.getApplication.mockRejectedValueOnce(new Error('not found'));
    const res = await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'tok' }), context);
    expect(res.status).toBe(404);
    expect(res.body).toContain('Not Found');
  });

  test('returns already approved message', async () => {
    storage.getApplication.mockResolvedValueOnce({ status: 'approved', city: 'Perth', country: 'Australia' });
    const res = await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'tok' }), context);
    expect(res.status).toBe(200);
    expect(res.body).toContain('Already Approved');
  });

  test('returns already rejected message', async () => {
    storage.getApplication.mockResolvedValueOnce({ status: 'rejected', city: 'Perth', country: 'Australia' });
    const res = await chapterApproval(approvalReq({ id: 'app-1', action: 'reject', token: 'tok' }), context);
    expect(res.status).toBe(200);
    expect(res.body).toContain('Already Rejected');
  });

  test('rejects application and updates status', async () => {
    storage.getApplication.mockResolvedValueOnce({ status: 'pending', city: 'Perth', country: 'Australia' });
    const res = await chapterApproval(approvalReq({ id: 'app-1', action: 'reject', token: 'tok' }), context);
    expect(res.status).toBe(200);
    expect(res.body).toContain('Application Rejected');
    expect(storage.updateApplicationStatus).toHaveBeenCalledWith('app-1', 'rejected');
  });

  test('approves application with Discord and status update', async () => {
    storage.getApplication.mockResolvedValueOnce({
      status: 'pending', city: 'Perth', country: 'Australia',
      fullName: 'Alice', email: 'alice@test.com'
    });
    const res = await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'tok' }), context);
    expect(res.status).toBe(200);
    expect(res.body).toContain('Chapter Approved');
    expect(discord.createChapterChannel).toHaveBeenCalledWith('Perth', context);
    expect(storage.updateApplicationStatus).toHaveBeenCalledWith('app-1', 'approved');
  });
});

// ─── registerEvent ──────────────────────────────────────────────────

describe('registerEvent function', () => {
  const registerEvent = require('../src/functions/registerEvent');

  beforeEach(() => jest.clearAllMocks());

  const validBody = { eventSlug: 'test-event', fullName: 'Alice', email: 'alice@test.com' };
  const mockEvent = {
    rowKey: 'ev-1', title: 'Test Event', slug: 'test-event', chapterSlug: 'perth',
    date: '2026-05-15', location: 'Perth', status: 'published', registrationCap: 100
  };

  test('rejects unauthenticated requests', async () => {
    const res = await registerEvent(makeRequest('POST', validBody), context);
    expect(res.status).toBe(401);
  });

  test('returns 429 when rate limited', async () => {
    rateLimiter.checkRateLimit.mockReturnValueOnce(false);
    const res = await registerEvent(makeAuthRequest('POST', validBody), context);
    expect(res.status).toBe(429);
  });

  test('returns 400 for missing required fields', async () => {
    const res = await registerEvent(makeAuthRequest('POST', { eventSlug: 'x' }), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Missing required/);
  });

  test('returns 404 when event not found', async () => {
    storage.getEventBySlug.mockResolvedValueOnce(null);
    const res = await registerEvent(makeAuthRequest('POST', validBody), context);
    expect(res.status).toBe(404);
  });

  test('returns 400 for closed event', async () => {
    storage.getEventBySlug.mockResolvedValueOnce({ ...mockEvent, status: 'closed' });
    const res = await registerEvent(makeAuthRequest('POST', validBody), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/closed/);
  });

  test('returns 409 for duplicate registration', async () => {
    storage.getEventBySlug.mockResolvedValueOnce(mockEvent);
    storage.getRegistrationsByEvent.mockResolvedValueOnce([
      { rowKey: 'r1', userId: 'test-user-123', ticketCode: 'EXISTING1' }
    ]);
    const res = await registerEvent(makeAuthRequest('POST', validBody), context);
    expect(res.status).toBe(409);
    expect(JSON.parse(res.body).ticketCode).toBe('EXISTING1');
  });

  test('returns 400 when event at capacity', async () => {
    storage.getEventBySlug.mockResolvedValueOnce({ ...mockEvent, registrationCap: 1 });
    storage.getRegistrationsByEvent.mockResolvedValueOnce([{ rowKey: 'r1', userId: 'other-user' }]);
    const res = await registerEvent(makeAuthRequest('POST', validBody), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/capacity/);
  });

  test('returns 201 on successful registration', async () => {
    storage.getEventBySlug.mockResolvedValueOnce(mockEvent);
    storage.getRegistrationsByEvent.mockResolvedValueOnce([]);
    const res = await registerEvent(makeAuthRequest('POST', validBody), context);
    expect(res.status).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.registration.ticketCode).toBeTruthy();
    expect(body.registration.eventTitle).toBe('Test Event');
    expect(storage.storeRegistration).toHaveBeenCalledTimes(1);
    expect(storage.storeDemographics).toHaveBeenCalledTimes(1);
    expect(emailService.sendTicketEmail).toHaveBeenCalledTimes(1);
  });

  test('does not fail registration if email send fails', async () => {
    storage.getEventBySlug.mockResolvedValueOnce(mockEvent);
    storage.getRegistrationsByEvent.mockResolvedValueOnce([]);
    emailService.sendTicketEmail.mockRejectedValueOnce(new Error('email failed'));
    const res = await registerEvent(makeAuthRequest('POST', validBody), context);
    expect(res.status).toBe(201);
  });
});

// ─── cancelRegistration ─────────────────────────────────────────────

describe('cancelRegistration function', () => {
  const cancelRegistration = require('../src/functions/cancelRegistration');

  beforeEach(() => jest.clearAllMocks());

  test('rejects unauthenticated requests', async () => {
    const res = await cancelRegistration(makeRequest('POST', { registrationId: 'r1' }), context);
    expect(res.status).toBe(401);
  });

  test('returns 400 for missing registrationId', async () => {
    const res = await cancelRegistration(makeAuthRequest('POST', {}), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/registrationId/);
  });

  test('returns 400 when registration not found', async () => {
    storage.getRegistrationsByUser.mockResolvedValueOnce([]);
    const res = await cancelRegistration(makeAuthRequest('POST', { registrationId: 'r99' }), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/not found/);
  });

  test('returns 400 when already checked in', async () => {
    storage.getRegistrationsByUser.mockResolvedValueOnce([
      { rowKey: 'r1', partitionKey: 'ev-1', checkedIn: true }
    ]);
    const res = await cancelRegistration(makeAuthRequest('POST', { registrationId: 'r1' }), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/checked in/);
  });

  test('successfully cancels registration', async () => {
    storage.getRegistrationsByUser.mockResolvedValueOnce([
      { rowKey: 'r1', partitionKey: 'ev-1', checkedIn: false, email: 'test@test.com', fullName: 'Alice' }
    ]);
    storage.getEventById.mockResolvedValueOnce({ title: 'Test Event', date: '2026-05-15' });
    const res = await cancelRegistration(makeAuthRequest('POST', { registrationId: 'r1' }), context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
    expect(storage.deleteRegistration).toHaveBeenCalledWith('ev-1', 'r1');
    expect(storage.deleteDemographics).toHaveBeenCalledWith('ev-1', 'r1');
    expect(emailService.sendCancellationEmail).toHaveBeenCalledTimes(1);
  });

  test('does not fail cancellation if email send fails', async () => {
    storage.getRegistrationsByUser.mockResolvedValueOnce([
      { rowKey: 'r1', partitionKey: 'ev-1', checkedIn: false }
    ]);
    storage.getEventById.mockResolvedValueOnce({ title: 'Test Event' });
    emailService.sendCancellationEmail.mockRejectedValueOnce(new Error('email failed'));
    const res = await cancelRegistration(makeAuthRequest('POST', { registrationId: 'r1' }), context);
    expect(res.status).toBe(200);
  });
});

// ─── createEvent ────────────────────────────────────────────────────

describe('createEvent function', () => {
  const createEvent = require('../src/functions/createEvent');

  beforeEach(() => jest.clearAllMocks());

  const validBody = {
    title: 'Test Event', date: '2026-06-01', description: 'A great event',
    chapterSlug: 'perth', locationAddress1: '45 St Georges Terrace',
    locationCity: 'Perth', locationState: 'WA'
  };

  test('rejects unauthenticated requests', async () => {
    const res = await createEvent(makeRequest('POST', validBody), context);
    expect(res.status).toBe(401);
  });

  test('rejects non-admin users', async () => {
    const res = await createEvent(makeAuthRequest('POST', validBody, ['authenticated']), context);
    expect(res.status).toBe(403);
  });

  test('returns 400 for missing required fields', async () => {
    const res = await createEvent(makeAuthRequest('POST', { title: 'X' }, ['admin']), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Missing required/);
  });

  test('returns 400 for missing address', async () => {
    const { locationAddress1, ...noAddress } = validBody;
    const res = await createEvent(makeAuthRequest('POST', noAddress, ['admin']), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/address/);
  });

  test('returns 400 for field length exceeded', async () => {
    const res = await createEvent(makeAuthRequest('POST', {
      ...validBody, title: 'A'.repeat(201)
    }, ['admin']), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/length/);
  });

  test('returns 201 on successful event creation', async () => {
    const res = await createEvent(makeAuthRequest('POST', validBody, ['admin']), context);
    expect(res.status).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.event.slug).toBeTruthy();
    expect(body.event.title).toBe('Test Event');
    expect(storage.storeEvent).toHaveBeenCalledTimes(1);
  });

  test('accepts legacy location field', async () => {
    const { locationAddress1, locationCity, locationState, ...base } = validBody;
    const res = await createEvent(makeAuthRequest('POST', {
      ...base, location: 'Perth Convention Centre'
    }, ['admin']), context);
    expect(res.status).toBe(201);
  });

  test('generates correct slug from title', async () => {
    const res = await createEvent(makeAuthRequest('POST', {
      ...validBody, title: 'Global Security Bootcamp 2026!'
    }, ['admin']), context);
    expect(res.status).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.event.slug).toBe('global-security-bootcamp-2026');
  });
});

// ─── issueBadges ────────────────────────────────────────────────────

describe('issueBadges function', () => {
  const issueBadges = require('../src/functions/issueBadges');

  beforeEach(() => jest.clearAllMocks());

  test('rejects unauthenticated requests', async () => {
    const res = await issueBadges(makeRequest('POST', { eventId: 'ev-1', chapterSlug: 'perth' }), context);
    expect(res.status).toBe(401);
  });

  test('rejects non-admin users', async () => {
    const res = await issueBadges(makeAuthRequest('POST', { eventId: 'ev-1', chapterSlug: 'perth' }, ['authenticated']), context);
    expect(res.status).toBe(403);
  });

  test('returns 400 for missing eventId or chapterSlug', async () => {
    const res = await issueBadges(makeAuthRequest('POST', { eventId: 'ev-1' }, ['admin']), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Missing/);
  });

  test('returns 404 when event not found', async () => {
    storage.getEvent.mockResolvedValueOnce(null);
    const res = await issueBadges(makeAuthRequest('POST', { eventId: 'ev-1', chapterSlug: 'perth' }, ['admin']), context);
    expect(res.status).toBe(404);
  });

  test('returns issued:0 when no checked-in registrations', async () => {
    storage.getEvent.mockResolvedValueOnce({ title: 'Test', date: '2026-05-15', location: 'Perth' });
    storage.getRegistrationsByEvent.mockResolvedValueOnce([
      { rowKey: 'r1', checkedIn: false }
    ]);
    const res = await issueBadges(makeAuthRequest('POST', { eventId: 'ev-1', chapterSlug: 'perth' }, ['admin']), context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).issued).toBe(0);
  });

  test('issues badges to checked-in registrations with correct roles', async () => {
    storage.getEvent.mockResolvedValueOnce({ title: 'Test', date: '2026-05-15', location: 'Perth' });
    storage.getRegistrationsByEvent.mockResolvedValueOnce([
      { rowKey: 'r1', fullName: 'Alice', email: 'alice@test.com', checkedIn: true, role: 'attendee', userId: 'u1' },
      { rowKey: 'r2', fullName: 'Bob', email: 'bob@test.com', checkedIn: true, role: 'speaker', userId: 'u2' },
      { rowKey: 'r3', fullName: 'Charlie', email: 'c@test.com', checkedIn: false }
    ]);
    const res = await issueBadges(makeAuthRequest('POST', { eventId: 'ev-1', chapterSlug: 'perth' }, ['admin']), context);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.issued).toBe(2);
    expect(body.total).toBe(2);
    expect(storage.storeBadge).toHaveBeenCalledTimes(2);
    expect(emailService.sendBadgeEmail).toHaveBeenCalledTimes(2);
    // Verify speaker gets Speaker badge type (now uses generateBadgePng)
    expect(badgeGen.generateBadgePng).toHaveBeenCalledWith(expect.objectContaining({ badgeType: 'Speaker' }), null);
  });
});

// ─── eventAttendance ────────────────────────────────────────────────

describe('eventAttendance function', () => {
  const eventAttendance = require('../src/functions/eventAttendance');

  beforeEach(() => jest.clearAllMocks());

  test('rejects unauthenticated requests', async () => {
    const req = makeRequest('GET');
    req.url = 'https://example.com/api/eventAttendance?eventId=ev-1';
    const res = await eventAttendance(req, context);
    expect(res.status).toBe(401);
  });

  test('rejects non-admin users', async () => {
    const req = makeAuthRequest('GET', null, ['authenticated']);
    req.url = 'https://example.com/api/eventAttendance?eventId=ev-1';
    const res = await eventAttendance(req, context);
    expect(res.status).toBe(403);
  });

  // POST tests
  test('POST: returns 400 for missing fields', async () => {
    const res = await eventAttendance(makeAuthRequest('POST', { eventId: 'ev-1' }, ['admin']), context);
    expect(res.status).toBe(400);
  });

  test('POST: returns 400 for invalid status', async () => {
    const res = await eventAttendance(makeAuthRequest('POST', {
      eventId: 'ev-1', chapterSlug: 'perth', status: 'invalid'
    }, ['admin']), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Invalid status/);
  });

  test('POST: updates event status', async () => {
    storage.updateEvent.mockResolvedValueOnce({ status: 'closed' });
    const res = await eventAttendance(makeAuthRequest('POST', {
      eventId: 'ev-1', chapterSlug: 'perth', status: 'closed'
    }, ['admin']), context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
    expect(storage.updateEvent).toHaveBeenCalledWith('perth', 'ev-1', { status: 'closed' });
  });

  // GET list
  test('GET list: returns enriched event list', async () => {
    storage.listEvents.mockResolvedValueOnce([
      { rowKey: 'ev-1', title: 'Test Event', slug: 'test', chapterSlug: 'perth', date: '2026-05-15', location: 'Perth', status: 'published', registrationCap: 100 }
    ]);
    storage.countRegistrations.mockResolvedValueOnce(42);
    const req = makeAuthRequest('GET', null, ['admin']);
    req.url = 'https://example.com/api/eventAttendance?action=list';
    const res = await eventAttendance(req, context);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].registrationCount).toBe(42);
  });

  // GET attendance detail
  test('GET: returns 400 for missing eventId', async () => {
    const req = makeAuthRequest('GET', null, ['admin']);
    req.url = 'https://example.com/api/eventAttendance';
    const res = await eventAttendance(req, context);
    expect(res.status).toBe(400);
  });

  test('GET: returns attendance details', async () => {
    storage.getRegistrationsByEvent.mockResolvedValueOnce([
      { rowKey: 'r1', fullName: 'Alice', email: 'a@a.com', ticketCode: 'ABC', role: 'attendee', checkedIn: true, checkedInAt: '2026-05-15T10:00:00Z', registeredAt: '2026-05-01T00:00:00Z', volunteerInterest: false },
      { rowKey: 'r2', fullName: 'Bob', email: 'b@b.com', ticketCode: 'DEF', checkedIn: false, registeredAt: '2026-05-02T00:00:00Z' }
    ]);
    const req = makeAuthRequest('GET', null, ['admin']);
    req.url = 'https://example.com/api/eventAttendance?eventId=ev-1';
    const res = await eventAttendance(req, context);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.total).toBe(2);
    expect(body.checkedIn).toBe(1);
    expect(body.attendees).toHaveLength(2);
  });

  test('GET csv: returns CSV format', async () => {
    storage.getRegistrationsByEvent.mockResolvedValueOnce([
      { rowKey: 'r1', fullName: 'Alice', email: 'a@a.com', ticketCode: 'ABC', role: 'attendee', checkedIn: true, checkedInAt: '2026-05-15T10:00:00Z', registeredAt: '2026-05-01T00:00:00Z', volunteerInterest: false }
    ]);
    const req = makeAuthRequest('GET', null, ['admin']);
    req.url = 'https://example.com/api/eventAttendance?eventId=ev-1&format=csv';
    const res = await eventAttendance(req, context);
    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/csv');
    expect(res.body).toContain('Name,Email');
    expect(res.body).toContain('Alice');
  });
});

// ─── badgeDownload ──────────────────────────────────────────────────

describe('badgeDownload function', () => {
  const badgeDownload = require('../src/functions/badgeDownload');

  beforeEach(() => jest.clearAllMocks());

  test('rejects unauthenticated requests', async () => {
    const req = makeRequest('GET');
    req.url = 'https://example.com/api/badge?eventId=ev-1&badgeId=b1';
    const res = await badgeDownload(req, context);
    expect(res.status).toBe(401);
  });

  test('returns 400 for missing parameters', async () => {
    const req = makeAuthRequest('GET', null, ['authenticated']);
    req.url = 'https://example.com/api/badge?eventId=ev-1';
    const res = await badgeDownload(req, context);
    expect(res.status).toBe(400);
  });

  test('returns 404 when badge not found', async () => {
    storage.getBadge.mockResolvedValueOnce(null);
    const req = makeAuthRequest('GET', null, ['authenticated']);
    req.url = 'https://example.com/api/badge?eventId=ev-1&badgeId=b99';
    const res = await badgeDownload(req, context);
    expect(res.status).toBe(404);
  });

  test('returns 403 when non-owner non-admin requests badge', async () => {
    storage.getBadge.mockResolvedValueOnce({
      userId: 'other-user', recipientName: 'Alice', partitionKey: 'ev-1', badgeType: 'Attendee'
    });
    const req = makeAuthRequest('GET', null, ['authenticated']);
    req.url = 'https://example.com/api/badge?eventId=ev-1&badgeId=b1';
    const res = await badgeDownload(req, context);
    expect(res.status).toBe(403);
  });

  test('returns SVG for badge owner', async () => {
    storage.getBadge.mockResolvedValueOnce({
      userId: 'test-user-123', recipientName: 'Alice', partitionKey: 'ev-1', badgeType: 'Attendee'
    });
    const req = makeAuthRequest('GET', null, ['authenticated']);
    req.url = 'https://example.com/api/badge?eventId=ev-1&badgeId=b1';
    const res = await badgeDownload(req, context);
    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('image/svg+xml');
    expect(res.body).toContain('svg');
  });

  test('returns SVG for admin user', async () => {
    storage.getBadge.mockResolvedValueOnce({
      userId: 'other-user', recipientName: 'Alice', partitionKey: 'ev-1', badgeType: 'Speaker'
    });
    const req = makeAuthRequest('GET', null, ['admin']);
    req.url = 'https://example.com/api/badge?eventId=ev-1&badgeId=b1';
    const res = await badgeDownload(req, context);
    expect(res.status).toBe(200);
    expect(res.headers['Content-Disposition']).toContain('speaker');
  });
});

// ─── getSessionizeData ──────────────────────────────────────────────

describe('getSessionizeData function', () => {
  const getSessionizeData = require('../src/functions/getSessionizeData');

  beforeEach(() => jest.clearAllMocks());

  test('returns 400 for missing sessionizeId', async () => {
    const req = makeRequest('GET');
    req.url = 'https://example.com/api/getSessionizeData?type=speakers';
    const res = await getSessionizeData(req, context);
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid type', async () => {
    const req = makeRequest('GET');
    req.url = 'https://example.com/api/getSessionizeData?sessionizeId=abc&type=invalid';
    const res = await getSessionizeData(req, context);
    expect(res.status).toBe(400);
  });

  test('returns 404 when no cached data', async () => {
    storage.getSessionizeCache.mockResolvedValueOnce(null);
    const req = makeRequest('GET');
    req.url = 'https://example.com/api/getSessionizeData?sessionizeId=abc&type=speakers';
    const res = await getSessionizeData(req, context);
    expect(res.status).toBe(404);
  });

  test('returns cached speaker data', async () => {
    storage.getSessionizeCache.mockResolvedValueOnce({
      data: [{ fullName: 'Alice', bio: 'Expert' }],
      lastRefreshed: '2026-03-18T10:00:00Z'
    });
    const req = makeRequest('GET');
    req.url = 'https://example.com/api/getSessionizeData?sessionizeId=abc&type=speakers';
    const res = await getSessionizeData(req, context);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].fullName).toBe('Alice');
    expect(body.lastRefreshed).toBeTruthy();
  });
});

// ─── refreshSessionize ─────────────────────────────────────────────

describe('refreshSessionize function', () => {
  const refreshSessionize = require('../src/functions/refreshSessionize');

  const originalFetch = global.fetch;
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });
  afterAll(() => { global.fetch = originalFetch; });

  test('rejects unauthenticated requests', async () => {
    const res = await refreshSessionize(makeRequest('POST', { sessionizeApiId: 'abc' }), context);
    expect(res.status).toBe(401);
  });

  test('rejects non-admin users', async () => {
    const res = await refreshSessionize(makeAuthRequest('POST', { sessionizeApiId: 'abc' }, ['authenticated']), context);
    expect(res.status).toBe(403);
  });

  test('returns 400 for missing sessionizeApiId', async () => {
    const res = await refreshSessionize(makeAuthRequest('POST', {}, ['admin']), context);
    expect(res.status).toBe(400);
  });

  test('caches speakers and agenda on success', async () => {
    const mockSpeakers = [{ fullName: 'Alice' }, { fullName: 'Bob' }];
    const mockAgenda = [{ timeSlots: [] }];
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSpeakers) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAgenda) });

    const res = await refreshSessionize(makeAuthRequest('POST', {
      eventId: 'ev-1', chapterSlug: 'perth', sessionizeApiId: 'abc123'
    }, ['admin']), context);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.speakers).toBe(2);
    expect(body.agenda).toBe(1);
    expect(body.speakerNames).toEqual(['Alice', 'Bob']);
    expect(storage.storeSessionizeCache).toHaveBeenCalledTimes(2);
  });

  test('handles Sessionize API failure gracefully', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const res = await refreshSessionize(makeAuthRequest('POST', {
      eventId: 'ev-1', chapterSlug: 'perth', sessionizeApiId: 'bad-id'
    }, ['admin']), context);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.speakers).toBe(0);
    expect(body.agenda).toBe(0);
    expect(body.message).toMatch(/No data/);
  });
});

// ─── chapterSubscribe ───────────────────────────────────────────────

describe('chapterSubscribe function', () => {
  const chapterSubscribe = require('../src/functions/chapterSubscribe');

  beforeEach(() => jest.clearAllMocks());

  test('rejects unauthenticated requests', async () => {
    const res = await chapterSubscribe(makeRequest('POST', { chapterSlug: 'perth', action: 'subscribe' }), context);
    expect(res.status).toBe(401);
  });

  test('returns 400 for missing fields', async () => {
    const res = await chapterSubscribe(makeAuthRequest('POST', { chapterSlug: 'perth' }), context);
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid action', async () => {
    const res = await chapterSubscribe(makeAuthRequest('POST', { chapterSlug: 'perth', action: 'delete' }), context);
    expect(res.status).toBe(400);
  });

  test('subscribes user successfully', async () => {
    const res = await chapterSubscribe(makeAuthRequest('POST', { chapterSlug: 'perth', action: 'subscribe' }), context);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.subscribed).toBe(true);
    expect(storage.storeSubscription).toHaveBeenCalledWith('perth', 'test@example.com');
  });

  test('unsubscribes user successfully', async () => {
    const res = await chapterSubscribe(makeAuthRequest('POST', { chapterSlug: 'perth', action: 'unsubscribe' }), context);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.subscribed).toBe(false);
    expect(storage.removeSubscription).toHaveBeenCalledWith('perth', 'test@example.com');
  });

  test('returns subscription status', async () => {
    storage.isSubscribed.mockResolvedValueOnce(true);
    const res = await chapterSubscribe(makeAuthRequest('POST', { chapterSlug: 'perth', action: 'status' }), context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).subscribed).toBe(true);
  });
});

// ─── communityPartner ───────────────────────────────────────────────

describe('communityPartner function', () => {
  const communityPartner = require('../src/functions/communityPartner');

  beforeEach(() => jest.clearAllMocks());

  test('rejects unauthenticated requests', async () => {
    const res = await communityPartner(makeRequest('POST', { eventId: 'ev-1' }), context);
    expect(res.status).toBe(401);
  });

  test('rejects non-admin users', async () => {
    const res = await communityPartner(makeAuthRequest('POST', { eventId: 'ev-1' }, ['authenticated']), context);
    expect(res.status).toBe(403);
  });

  test('returns 400 for missing eventId', async () => {
    const res = await communityPartner(makeAuthRequest('POST', {}, ['admin']), context);
    expect(res.status).toBe(400);
  });

  test('returns 400 for missing name', async () => {
    const res = await communityPartner(makeAuthRequest('POST', { eventId: 'ev-1', logoBase64: 'abc' }, ['admin']), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/name/);
  });

  test('returns 400 for missing logo', async () => {
    const res = await communityPartner(makeAuthRequest('POST', { eventId: 'ev-1', name: 'Acme' }, ['admin']), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/logo/i);
  });

  test('returns 400 for oversized logo', async () => {
    const res = await communityPartner(makeAuthRequest('POST', {
      eventId: 'ev-1', name: 'Acme', logoBase64: 'x'.repeat(210000)
    }, ['admin']), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/too large/i);
  });

  test('adds partner successfully', async () => {
    const res = await communityPartner(makeAuthRequest('POST', {
      eventId: 'ev-1', name: 'Acme Corp', tier: 'Gold', logoBase64: 'abc123', logoContentType: 'image/png', website: 'https://acme.com'
    }, ['admin']), context);
    expect(res.status).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.partner.name).toBe('Acme Corp');
    expect(storage.storePartner).toHaveBeenCalledTimes(1);
  });

  test('deletes partner successfully', async () => {
    const res = await communityPartner(makeAuthRequest('POST', {
      eventId: 'ev-1', partnerId: 'p-1', action: 'delete'
    }, ['admin']), context);
    expect(res.status).toBe(200);
    expect(storage.deletePartner).toHaveBeenCalledWith('ev-1', 'p-1');
  });
});

// ─── getCommunityPartners ───────────────────────────────────────────

describe('getCommunityPartners function', () => {
  const getCommunityPartners = require('../src/functions/getCommunityPartners');

  beforeEach(() => jest.clearAllMocks());

  test('returns 400 for missing parameters', async () => {
    const req = makeRequest('GET');
    req.url = 'https://example.com/api/getCommunityPartners';
    const res = await getCommunityPartners(req, context);
    expect(res.status).toBe(400);
  });

  test('returns partners grouped by tier', async () => {
    storage.getPartnersByEvent.mockResolvedValueOnce([
      { id: 'p1', name: 'Acme', tier: 'Gold', logoBase64: 'abc', logoContentType: 'image/png', website: 'https://acme.com' },
      { id: 'p2', name: 'Beta', tier: 'Gold', logoBase64: 'def', logoContentType: 'image/png', website: '' },
      { id: 'p3', name: 'Gamma', tier: 'Silver', logoBase64: 'ghi', logoContentType: 'image/png', website: '' }
    ]);
    const req = makeRequest('GET');
    req.url = 'https://example.com/api/getCommunityPartners?eventId=ev-1';
    const res = await getCommunityPartners(req, context);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.partners['Gold']).toHaveLength(2);
    expect(body.partners['Silver']).toHaveLength(1);
    expect(body.partners['Gold'][0].logoDataUrl).toContain('data:image/png;base64,abc');
  });

  test('returns empty when no partners', async () => {
    storage.getPartnersByEvent.mockResolvedValueOnce([]);
    const req = makeRequest('GET');
    req.url = 'https://example.com/api/getCommunityPartners?eventId=ev-1';
    const res = await getCommunityPartners(req, context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).partners).toEqual({});
  });
});

// ─── regenerateImage ────────────────────────────────────────────────

describe('regenerateImage function', () => {
  const regenerateImage = require('../src/functions/regenerateImage');

  beforeEach(() => jest.clearAllMocks());

  test('rejects unauthenticated requests', async () => {
    const res = await regenerateImage(makeRequest('POST', { type: 'event', slug: 'test' }), context);
    expect(res.status).toBe(401);
  });

  test('rejects non-admin users', async () => {
    const res = await regenerateImage(makeAuthRequest('POST', { type: 'event', slug: 'test' }, ['authenticated']), context);
    expect(res.status).toBe(403);
  });

  test('returns 400 for missing type or slug', async () => {
    const res = await regenerateImage(makeAuthRequest('POST', { type: 'event' }, ['admin']), context);
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid type', async () => {
    const res = await regenerateImage(makeAuthRequest('POST', { type: 'invalid', slug: 'test' }, ['admin']), context);
    expect(res.status).toBe(400);
  });

  test('regenerates event badge image', async () => {
    storage.getEventBySlug.mockResolvedValueOnce({
      rowKey: 'ev-1', title: 'Test Event', chapterSlug: 'perth', locationCity: 'Perth'
    });
    const res = await regenerateImage(makeAuthRequest('POST', { type: 'event', slug: 'test-event' }, ['admin']), context);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.imageUrl).toBeTruthy();
  });

  test('regenerates chapter banner', async () => {
    storage.getApprovedApplicationBySlug.mockResolvedValueOnce({
      city: 'Perth', country: 'Australia', partitionKey: 'chapter', rowKey: 'app-1'
    });
    const res = await regenerateImage(makeAuthRequest('POST', { type: 'chapter', slug: 'perth' }, ['admin']), context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
  });
});
