/**
 * Tests for API functions that can run without Azure dependencies.
 * Uses mocked request/context objects to simulate Azure Functions runtime.
 */

// Mock Table Storage module
jest.mock('../src/helpers/tableStorage', () => ({
  storeApplication: jest.fn().mockResolvedValue({}),
  getApplication: jest.fn(),
  updateApplicationStatus: jest.fn().mockResolvedValue({}),
  storeEvent: jest.fn().mockResolvedValue({}),
  getEvent: jest.fn(),
  getEventBySlug: jest.fn(),
  listEvents: jest.fn().mockResolvedValue([]),
  updateEvent: jest.fn().mockResolvedValue({}),
  storeRegistration: jest.fn().mockResolvedValue({}),
  getRegistrationByTicketCode: jest.fn(),
  getRegistrationsByUser: jest.fn().mockResolvedValue([]),
  getRegistrationsByEvent: jest.fn().mockResolvedValue([]),
  countRegistrations: jest.fn().mockResolvedValue(0),
  updateRegistration: jest.fn().mockResolvedValue({}),
  storeDemographics: jest.fn().mockResolvedValue({}),
  storeBadge: jest.fn().mockResolvedValue({}),
  getBadge: jest.fn(),
  getBadgesByEvent: jest.fn().mockResolvedValue([]),
  getApprovedApplicationByEmail: jest.fn()
}));

jest.mock('../src/helpers/discordBot', () => ({
  sendMessage: jest.fn().mockResolvedValue(true),
  createChapterChannel: jest.fn().mockResolvedValue({ channelId: '123', channelName: 'test' })
}));

jest.mock('../src/helpers/emailService', () => ({
  sendTicketEmail: jest.fn().mockResolvedValue({}),
  sendBadgeEmail: jest.fn().mockResolvedValue({})
}));

const storage = require('../src/helpers/tableStorage');

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

describe('getEvent function', () => {
  const getEvent = require('../src/functions/getEvent');

  beforeEach(() => jest.clearAllMocks());

  test('returns 400 when no slug provided', async () => {
    const req = { ...makeRequest('GET'), url: 'https://example.com/api/getEvent' };
    const res = await getEvent(req, context);
    expect(res.status).toBe(400);
  });

  test('returns 404 when event not found', async () => {
    storage.getEventBySlug.mockResolvedValueOnce(null);
    const req = { ...makeRequest('GET'), url: 'https://example.com/api/getEvent?slug=nonexistent' };
    const res = await getEvent(req, context);
    expect(res.status).toBe(404);
  });

  test('returns event details with registration count', async () => {
    storage.getEventBySlug.mockResolvedValueOnce({
      rowKey: 'ev-1',
      title: 'Test Event',
      slug: 'test-event',
      chapterSlug: 'perth',
      date: '2026-05-15',
      endDate: '',
      location: 'Perth',
      description: 'A test event',
      sessionizeApiId: '',
      registrationCap: 100,
      status: 'published'
    });
    storage.countRegistrations.mockResolvedValueOnce(42);

    const req = { ...makeRequest('GET'), url: 'https://example.com/api/getEvent?slug=test-event' };
    const res = await getEvent(req, context);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.title).toBe('Test Event');
    expect(body.registrationCount).toBe(42);
    expect(body.registrationCap).toBe(100);
  });
});

describe('checkIn function', () => {
  const checkIn = require('../src/functions/checkIn');

  beforeEach(() => jest.clearAllMocks());

  test('rejects unauthenticated requests', async () => {
    const req = makeRequest('POST', { ticketCode: 'ABC', eventId: 'ev-1' });
    const res = await checkIn(req, context);
    expect(res.status).toBe(401);
  });

  test('rejects non-admin users', async () => {
    const req = makeAuthRequest('POST', { ticketCode: 'ABC', eventId: 'ev-1' }, ['authenticated']);
    const res = await checkIn(req, context);
    expect(res.status).toBe(403);
  });

  test('returns 404 for invalid ticket', async () => {
    storage.getRegistrationByTicketCode.mockResolvedValueOnce(null);
    const req = makeAuthRequest('POST', { ticketCode: 'INVALID', eventId: 'ev-1' }, ['admin']);
    const res = await checkIn(req, context);
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body).status).toBe('invalid');
  });

  test('checks in valid ticket', async () => {
    storage.getRegistrationByTicketCode.mockResolvedValueOnce({
      rowKey: 'reg-1',
      fullName: 'Alice',
      checkedIn: false
    });
    const req = makeAuthRequest('POST', { ticketCode: 'ABCD1234', eventId: 'ev-1' }, ['admin']);
    const res = await checkIn(req, context);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('checked_in');
    expect(body.attendeeName).toBe('Alice');
    expect(storage.updateRegistration).toHaveBeenCalled();
  });

  test('returns already_checked_in for duplicate scan', async () => {
    storage.getRegistrationByTicketCode.mockResolvedValueOnce({
      rowKey: 'reg-1',
      fullName: 'Alice',
      checkedIn: true,
      checkedInAt: '2026-05-15T10:00:00Z'
    });
    const req = makeAuthRequest('POST', { ticketCode: 'ABCD1234', eventId: 'ev-1' }, ['admin']);
    const res = await checkIn(req, context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).status).toBe('already_checked_in');
    expect(storage.updateRegistration).not.toHaveBeenCalled();
  });
});

describe('myTickets function', () => {
  const myTickets = require('../src/functions/myTickets');

  beforeEach(() => jest.clearAllMocks());

  test('rejects unauthenticated requests', async () => {
    const req = makeRequest('GET');
    const res = await myTickets(req, context);
    expect(res.status).toBe(401);
  });

  test('returns empty tickets array for user with no registrations', async () => {
    storage.getRegistrationsByUser.mockResolvedValueOnce([]);
    const req = makeAuthRequest('GET', null, ['authenticated']);
    const res = await myTickets(req, context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).tickets).toEqual([]);
  });
});

describe('roles function', () => {
  const roles = require('../src/functions/roles');

  beforeEach(() => jest.clearAllMocks());

  test('returns empty roles for unknown email', async () => {
    storage.getApprovedApplicationByEmail.mockResolvedValueOnce(null);
    const req = makeRequest('POST', { userId: 'u1', userDetails: 'nobody@test.com' });
    const res = await roles(req, context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).roles).toEqual([]);
  });

  test('returns admin role for approved chapter lead', async () => {
    storage.getApprovedApplicationByEmail.mockResolvedValueOnce({ city: 'Perth', email: 'lead@test.com' });
    const req = makeRequest('POST', { userId: 'u1', userDetails: 'lead@test.com' });
    const res = await roles(req, context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).roles).toContain('admin');
  });

  test('handles missing body gracefully', async () => {
    const req = makeRequest('POST', {});
    const res = await roles(req, context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).roles).toEqual([]);
  });
});
