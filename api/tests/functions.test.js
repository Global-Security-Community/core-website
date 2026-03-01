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
  getEventById: jest.fn(),
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
  getRegistrationsByRole: jest.fn().mockResolvedValue([]),
  isVolunteerOrOrganiserByRegistration: jest.fn().mockResolvedValue(null),
  isVolunteerForAnyEvent: jest.fn().mockResolvedValue(null),
  VALID_ROLES: ['attendee', 'volunteer', 'speaker', 'sponsor', 'organiser'],
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

  test('returns volunteer role for user with volunteer registration', async () => {
    storage.getApprovedApplicationByEmail.mockResolvedValueOnce(null);
    storage.isVolunteerOrOrganiserByRegistration.mockResolvedValueOnce({ role: 'volunteer', email: 'vol@test.com' });
    const req = makeRequest('POST', { userId: 'u1', userDetails: 'vol@test.com' });
    const res = await roles(req, context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).roles).toContain('volunteer');
  });

  test('returns volunteer role for user with organiser registration', async () => {
    storage.getApprovedApplicationByEmail.mockResolvedValueOnce(null);
    storage.isVolunteerOrOrganiserByRegistration.mockResolvedValueOnce({ role: 'organiser', email: 'org@test.com' });
    const req = makeRequest('POST', { userId: 'u1', userDetails: 'org@test.com' });
    const res = await roles(req, context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).roles).toContain('volunteer');
  });

  test('handles missing body gracefully', async () => {
    const req = makeRequest('POST', {});
    const res = await roles(req, context);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).roles).toEqual([]);
  });
});

describe('updateRegistrationRole function', () => {
  const updateRole = require('../src/functions/updateRegistrationRole');

  beforeEach(() => jest.clearAllMocks());

  test('rejects unauthenticated requests', async () => {
    const req = makeRequest('POST', {});
    const res = await updateRole(req, context);
    expect(res.status).toBe(401);
  });

  test('rejects non-admin users', async () => {
    const req = makeAuthRequest('POST', { eventId: 'ev-1', registrationIds: ['r1'], role: 'volunteer' }, ['authenticated']);
    const res = await updateRole(req, context);
    expect(res.status).toBe(403);
  });

  test('rejects invalid role', async () => {
    const req = makeAuthRequest('POST', { eventId: 'ev-1', registrationIds: ['r1'], role: 'invalid' }, ['admin']);
    const res = await updateRole(req, context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Invalid role/);
  });

  test('rejects missing fields', async () => {
    const req = makeAuthRequest('POST', { eventId: 'ev-1' }, ['admin']);
    const res = await updateRole(req, context);
    expect(res.status).toBe(400);
  });

  test('updates roles for valid registrations', async () => {
    storage.getRegistrationsByEvent.mockResolvedValueOnce([
      { rowKey: 'r1', fullName: 'Alice', role: 'attendee' },
      { rowKey: 'r2', fullName: 'Bob', role: 'attendee' }
    ]);
    const req = makeAuthRequest('POST', { eventId: 'ev-1', registrationIds: ['r1', 'r2'], role: 'volunteer' }, ['admin']);
    const res = await updateRole(req, context);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.updated).toBe(2);
    expect(storage.updateRegistration).toHaveBeenCalledTimes(2);
  });

  test('reports errors for non-existent registrations', async () => {
    storage.getRegistrationsByEvent.mockResolvedValueOnce([
      { rowKey: 'r1', fullName: 'Alice' }
    ]);
    const req = makeAuthRequest('POST', { eventId: 'ev-1', registrationIds: ['r1', 'r99'], role: 'speaker' }, ['admin']);
    const res = await updateRole(req, context);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.updated).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].id).toBe('r99');
  });
});

describe('adminRegister function', () => {
  const adminRegister = require('../src/functions/adminRegister');

  beforeEach(() => jest.clearAllMocks());

  test('rejects unauthenticated requests', async () => {
    const req = makeRequest('POST', {});
    const res = await adminRegister(req, context);
    expect(res.status).toBe(401);
  });

  test('rejects non-admin users', async () => {
    const req = makeAuthRequest('POST', { eventId: 'ev-1', name: 'Alice', email: 'alice@test.com' }, ['authenticated']);
    const res = await adminRegister(req, context);
    expect(res.status).toBe(403);
  });

  test('rejects invalid role', async () => {
    const req = makeAuthRequest('POST', { eventId: 'ev-1', name: 'Alice', email: 'alice@test.com', role: 'invalid' }, ['admin']);
    const res = await adminRegister(req, context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Invalid role/);
  });

  test('blocks attendee registration at capacity', async () => {
    storage.getEventById.mockResolvedValueOnce({ rowKey: 'ev-1', title: 'Test', status: 'published', registrationCap: 2 });
    storage.getRegistrationsByEvent.mockResolvedValueOnce([{ rowKey: 'r1', email: 'a@a.com' }, { rowKey: 'r2', email: 'b@b.com' }]);
    const req = makeAuthRequest('POST', { eventId: 'ev-1', name: 'Alice', email: 'alice@test.com', role: 'attendee' }, ['admin']);
    const res = await adminRegister(req, context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/capacity/i);
  });

  test('allows speaker registration at capacity (cap bypass)', async () => {
    storage.getEventById.mockResolvedValueOnce({ rowKey: 'ev-1', title: 'Test', status: 'published', registrationCap: 2 });
    storage.getRegistrationsByEvent.mockResolvedValueOnce([{ rowKey: 'r1', email: 'x@x.com' }, { rowKey: 'r2', email: 'y@y.com' }]);
    const req = makeAuthRequest('POST', { eventId: 'ev-1', name: 'Speaker', email: 'speaker@test.com', role: 'speaker' }, ['admin']);
    const res = await adminRegister(req, context);
    expect(res.status).toBe(201);
    expect(JSON.parse(res.body).registration.role).toBe('speaker');
  });

  test('rejects duplicate email', async () => {
    storage.getEventById.mockResolvedValueOnce({ rowKey: 'ev-1', title: 'Test', status: 'published', registrationCap: 0 });
    storage.getRegistrationsByEvent.mockResolvedValueOnce([{ rowKey: 'r1', email: 'alice@test.com' }]);
    const req = makeAuthRequest('POST', { eventId: 'ev-1', name: 'Alice', email: 'alice@test.com' }, ['admin']);
    const res = await adminRegister(req, context);
    expect(res.status).toBe(409);
  });

  test('registers with default attendee role', async () => {
    storage.getEventById.mockResolvedValueOnce({ rowKey: 'ev-1', title: 'Test', status: 'published', registrationCap: 0 });
    storage.getRegistrationsByEvent.mockResolvedValueOnce([]);
    const req = makeAuthRequest('POST', { eventId: 'ev-1', name: 'Bob', email: 'bob@test.com' }, ['admin']);
    const res = await adminRegister(req, context);
    expect(res.status).toBe(201);
    expect(JSON.parse(res.body).registration.role).toBe('attendee');
  });
});
