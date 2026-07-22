const mockJobs = new Map();
const mockDeliveries = new Map();
const mockBadges = new Map();
let mockEtag = 0;

function mockConflict(statusCode) {
  return Object.assign(new Error('Conflict'), { statusCode });
}

jest.mock('../src/helpers/auth', () => ({
  getAuthUser: jest.fn().mockReturnValue({
    userId: 'admin-1',
    userDetails: 'organiser@example.com',
    userRoles: ['admin']
  }),
  hasRole: jest.fn().mockReturnValue(true),
  unauthorised: jest.fn().mockReturnValue({ status: 401 }),
  forbidden: jest.fn(message => ({ status: 403, jsonBody: { error: message } })),
  verifyChapterAccess: jest.fn().mockResolvedValue(true),
  verifyCsrfHeader: jest.fn().mockReturnValue(null)
}));

jest.mock('../src/helpers/tableStorage', () => ({
  getEvent: jest.fn(),
  getRegistrationsByEvent: jest.fn(),
  getBadge: jest.fn(async (eventId, badgeId) => mockBadges.get(`${eventId}:${badgeId}`)),
  getBadgesByEvent: jest.fn(async eventId => (
    [...mockBadges.values()].filter(badge => badge.partitionKey === eventId)
  )),
  storeBadge: jest.fn(async badge => {
    const key = `${badge.eventId}:${badge.id}`;
    if (mockBadges.has(key)) throw mockConflict(409);
    const entity = { ...badge, partitionKey: badge.eventId, rowKey: badge.id };
    mockBadges.set(key, entity);
    return entity;
  }),
  deleteBadge: jest.fn(async (eventId, badgeId) => {
    mockBadges.delete(`${eventId}:${badgeId}`);
  }),
  getPostEventJob: jest.fn(async eventId => mockJobs.get(eventId) || null),
  upsertPostEventJob: jest.fn(async (eventId, updates) => {
    const job = {
      ...(mockJobs.get(eventId) || {}),
      ...updates,
      partitionKey: eventId,
      rowKey: 'job',
      etag: `etag-${++mockEtag}`
    };
    mockJobs.set(eventId, job);
    return job;
  }),
  createPostEventJob: jest.fn(async (eventId, values) => {
    if (mockJobs.has(eventId)) throw mockConflict(409);
    const job = {
      ...values,
      partitionKey: eventId,
      rowKey: 'job',
      etag: `etag-${++mockEtag}`
    };
    mockJobs.set(eventId, job);
    return job;
  }),
  updatePostEventJob: jest.fn(async (eventId, updates, etag) => {
    const existing = mockJobs.get(eventId);
    if (!existing || existing.etag !== etag) throw mockConflict(412);
    const job = { ...existing, ...updates, etag: `etag-${++mockEtag}` };
    mockJobs.set(eventId, job);
    return job;
  }),
  getPostEventDeliveries: jest.fn(async eventId => (
    [...mockDeliveries.values()].filter(delivery => delivery.partitionKey === eventId)
  )),
  upsertPostEventDelivery: jest.fn(async (eventId, rowKey, updates) => {
    const key = `${eventId}:${rowKey}`;
    const delivery = {
      ...(mockDeliveries.get(key) || {}),
      ...updates,
      partitionKey: eventId,
      rowKey,
      etag: `etag-${++mockEtag}`
    };
    mockDeliveries.set(key, delivery);
    return delivery;
  }),
  createPostEventDelivery: jest.fn(async (eventId, rowKey, values) => {
    const key = `${eventId}:${rowKey}`;
    if (mockDeliveries.has(key)) throw mockConflict(409);
    const delivery = {
      ...values,
      partitionKey: eventId,
      rowKey,
      etag: `etag-${++mockEtag}`
    };
    mockDeliveries.set(key, delivery);
    return delivery;
  }),
  updatePostEventDelivery: jest.fn(async (eventId, rowKey, updates, etag) => {
    const key = `${eventId}:${rowKey}`;
    const existing = mockDeliveries.get(key);
    if (!existing || existing.etag !== etag) throw mockConflict(412);
    const delivery = { ...existing, ...updates, etag: `etag-${++mockEtag}` };
    mockDeliveries.set(key, delivery);
    return delivery;
  })
}));

jest.mock('../src/helpers/badgeGenerator', () => ({
  generateSharedEventBadgePng: jest.fn().mockResolvedValue(Buffer.from('badge'))
}));

jest.mock('../src/helpers/imageGenerator', () => ({
  downloadGeneratedImage: jest.fn().mockResolvedValue(Buffer.from('stored-badge'))
}));

jest.mock('../src/helpers/emailService', () => ({
  sendPostEventEmail: jest.fn().mockResolvedValue({ status: 'Succeeded' })
}));

jest.mock('../src/helpers/auditLog', () => ({
  logAudit: jest.fn()
}));

jest.mock('../src/helpers/rateLimiter', () => ({
  checkRateLimit: jest.fn().mockReturnValue(true),
  getClientIP: jest.fn().mockReturnValue('127.0.0.1')
}));

const storage = require('../src/helpers/tableStorage');
const emailService = require('../src/helpers/emailService');
const badgeGenerator = require('../src/helpers/badgeGenerator');
const postEventCommunication = require('../src/functions/postEventCommunication');
const { emailOperationId } = postEventCommunication;
const {
  getDefaultTemplates,
  formatEventDate,
  renderTemplate,
  summariseRecipients,
  validateTemplates
} = require('../src/helpers/postEventCommunication');

const event = {
  rowKey: 'ev-1',
  partitionKey: 'perth',
  chapterSlug: 'perth',
  title: 'Security Day',
  date: '2026-08-01',
  location: 'Perth',
  status: 'completed'
};

function request(method, body, query = '') {
  return {
    method,
    url: `https://globalsecurity.community/api/postEventCommunication${query}`,
    headers: { get: header => header === 'x-requested-with' ? 'fetch' : null },
    json: async () => body || {}
  };
}

const context = { log: jest.fn() };

describe('post-event communication helpers', () => {
  test('summarises only checked-in recipients and deduplicates email addresses', () => {
    expect(summariseRecipients([
      { email: 'one@example.com', checkedIn: true, role: 'speaker' },
      { email: 'ONE@example.com', checkedIn: 'true', role: 'speaker' },
      { email: 'two@example.com', checkedIn: false, role: 'volunteer' },
      { email: 'three@example.com', checkedIn: 'true', role: 'sponsor' }
    ])).toEqual({
      total: 2,
      roles: { attendee: 0, volunteer: 0, speaker: 1, organiser: 0, sponsor: 1 }
    });
  });

  test('validates placeholders and personalises templates', () => {
    const templates = getDefaultTemplates();
    expect(validateTemplates(templates).valid).toBe(true);
    expect(validateTemplates({
      ...templates,
      attendee: { subject: 'Hi {unknown}', message: 'Test' }
    })).toMatchObject({ valid: false, error: 'Unsupported placeholder {unknown}' });
    expect(renderTemplate(
      'Hi {firstName}, welcome to {eventTitle} from {chapterName}.',
      { fullName: 'Alice Example' },
      event
    )).toBe('Hi Alice, welcome to Security Day from Perth.');
    expect(formatEventDate('2026-08-01')).toBe('1 August 2026');
    expect(emailOperationId('event', 'alice@example.com', 1)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});

describe('postEventCommunication function', () => {
  beforeEach(() => {
    mockJobs.clear();
    mockDeliveries.clear();
    mockBadges.clear();
    mockEtag = 0;
    jest.clearAllMocks();
    storage.getEvent.mockResolvedValue(event);
    storage.getBadgesByEvent.mockImplementation(async eventId => (
      [...mockBadges.values()].filter(badge => badge.partitionKey === eventId)
    ));
    storage.getRegistrationsByEvent.mockResolvedValue([
      { rowKey: 'r1', fullName: 'Alice Speaker', email: 'alice@example.com', checkedIn: true, role: 'speaker' },
      { rowKey: 'r2', fullName: 'Victor Volunteer', email: 'victor@example.com', checkedIn: 'true', role: 'volunteer' },
      { rowKey: 'r3', fullName: 'No Show', email: 'noshow@example.com', checkedIn: false, role: 'attendee' }
    ]);
    emailService.sendPostEventEmail.mockResolvedValue({ status: 'Succeeded' });
  });

  test('returns editable defaults and checked-in role counts', async () => {
    const response = await postEventCommunication(
      request('GET', null, '?eventId=ev-1&chapterSlug=perth'),
      context
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody.recipients).toEqual({
      total: 2,
      roles: { attendee: 0, volunteer: 1, speaker: 1, organiser: 0, sponsor: 0 }
    });
    expect(response.jsonBody.templates.speaker.subject).toContain('{eventTitle}');
  });

  test('starts and processes a resumable checked-in recipient job', async () => {
    const templates = getDefaultTemplates();
    const started = await postEventCommunication(request('POST', {
      action: 'start',
      eventId: 'ev-1',
      chapterSlug: 'perth',
      templates
    }), context);
    expect(started.status).toBe(200);
    expect(started.jsonBody.progress).toMatchObject({ total: 2, pending: 2, sent: 0 });

    const processed = await postEventCommunication(request('POST', {
      action: 'processBatch',
      eventId: 'ev-1',
      chapterSlug: 'perth'
    }), context);

    expect(processed.status).toBe(200);
    expect(processed.jsonBody).toMatchObject({
      jobStatus: 'completed',
      progress: { total: 2, pending: 0, sent: 2, failed: 0 }
    });
    expect(emailService.sendPostEventEmail).toHaveBeenCalledTimes(2);
    expect(emailService.sendPostEventEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com' }),
      expect.any(String),
      event,
      'Speaker',
      'Thank you for speaking at Security Day',
      expect.stringContaining('Hi Alice'),
      context,
      'image/png',
      'gsc-speaker-badge.png',
      expect.stringMatching(/^[0-9a-f-]{36}$/)
    );
  });

  test('saves drafts but rejects invalid placeholders and edits after sending starts', async () => {
    const templates = getDefaultTemplates();
    const invalid = await postEventCommunication(request('POST', {
      action: 'saveDraft',
      eventId: 'ev-1',
      chapterSlug: 'perth',
      templates: {
        ...templates,
        attendee: { subject: 'Thanks {unsupported}', message: 'Hello' }
      }
    }), context);
    expect(invalid.status).toBe(400);

    const saved = await postEventCommunication(request('POST', {
      action: 'saveDraft',
      eventId: 'ev-1',
      chapterSlug: 'perth',
      templates
    }), context);
    expect(saved.status).toBe(200);

    await postEventCommunication(request('POST', {
      action: 'start',
      eventId: 'ev-1',
      chapterSlug: 'perth',
      templates
    }), context);
    const locked = await postEventCommunication(request('POST', {
      action: 'saveDraft',
      eventId: 'ev-1',
      chapterSlug: 'perth',
      templates
    }), context);
    expect(locked.status).toBe(409);
  });

  test('cannot overwrite frozen templates when a draft save loses an ETag race', async () => {
    const templates = getDefaultTemplates();
    await postEventCommunication(request('POST', {
      action: 'saveDraft',
      eventId: 'ev-1',
      chapterSlug: 'perth',
      templates
    }), context);
    storage.updatePostEventJob.mockImplementationOnce(async eventId => {
      mockJobs.set(eventId, {
        ...mockJobs.get(eventId),
        startedAt: new Date().toISOString(),
        status: 'initialising',
        etag: `etag-${++mockEtag}`
      });
      throw mockConflict(412);
    });

    const raced = await postEventCommunication(request('POST', {
      action: 'saveDraft',
      eventId: 'ev-1',
      chapterSlug: 'perth',
      templates: {
        ...templates,
        attendee: { subject: 'Changed after start', message: 'This must not be stored.' }
      }
    }), context);

    expect(raced.status).toBe(409);
    expect(JSON.parse(mockJobs.get('ev-1').templatesJson).attendee.subject)
      .toBe(templates.attendee.subject);
  });

  test('does not start until the event is completed', async () => {
    storage.getEvent.mockResolvedValue({ ...event, status: 'published' });
    const response = await postEventCommunication(request('POST', {
      action: 'start',
      eventId: 'ev-1',
      chapterSlug: 'perth',
      templates: getDefaultTemplates()
    }), context);

    expect(response).toMatchObject({
      status: 400,
      jsonBody: { error: 'Mark the event complete before sending post-event communications' }
    });
    expect(storage.upsertPostEventDelivery).not.toHaveBeenCalled();
  });

  test('reports the frozen recipient snapshot after sending starts', async () => {
    await postEventCommunication(request('POST', {
      action: 'start',
      eventId: 'ev-1',
      chapterSlug: 'perth',
      templates: getDefaultTemplates()
    }), context);
    storage.getRegistrationsByEvent.mockResolvedValue([
      { email: 'late@example.com', checkedIn: true, role: 'organiser' }
    ]);

    const response = await postEventCommunication(
      request('GET', null, '?eventId=ev-1&chapterSlug=perth'),
      context
    );
    expect(response.jsonBody.recipients).toEqual({
      total: 2,
      roles: { attendee: 0, volunteer: 1, speaker: 1, organiser: 0, sponsor: 0 }
    });
  });

  test('rolls back failed badge reservations and retries only failed recipients', async () => {
    await postEventCommunication(request('POST', {
      action: 'start',
      eventId: 'ev-1',
      chapterSlug: 'perth',
      templates: getDefaultTemplates()
    }), context);
    emailService.sendPostEventEmail
      .mockRejectedValueOnce(Object.assign(new Error('ACS failed'), { deliveryDefinitive: true }))
      .mockResolvedValue({ status: 'Succeeded' });

    const firstBatch = await postEventCommunication(request('POST', {
      action: 'processBatch',
      eventId: 'ev-1',
      chapterSlug: 'perth'
    }), context);
    expect(firstBatch.jsonBody.progress).toMatchObject({ sent: 1, failed: 1, pending: 0 });
    expect(storage.deleteBadge).toHaveBeenCalledTimes(1);

    const retry = await postEventCommunication(request('POST', {
      action: 'retryFailed',
      eventId: 'ev-1',
      chapterSlug: 'perth'
    }), context);
    expect(retry.jsonBody).toMatchObject({
      retried: 1,
      progress: { sent: 1, failed: 0, pending: 1 }
    });

    const finished = await postEventCommunication(request('POST', {
      action: 'processBatch',
      eventId: 'ev-1',
      chapterSlug: 'perth'
    }), context);
    expect(finished.jsonBody).toMatchObject({
      jobStatus: 'completed',
      progress: { sent: 2, failed: 0, pending: 0 }
    });
    expect(emailService.sendPostEventEmail).toHaveBeenCalledTimes(3);
  });

  test('reuses the same ACS operation after an ambiguous polling failure', async () => {
    await postEventCommunication(request('POST', {
      action: 'start',
      eventId: 'ev-1',
      chapterSlug: 'perth',
      templates: getDefaultTemplates()
    }), context);
    emailService.sendPostEventEmail
      .mockRejectedValueOnce(new Error('Polling connection lost'))
      .mockResolvedValue({ status: 'Succeeded' });

    const firstBatch = await postEventCommunication(request('POST', {
      action: 'processBatch',
      eventId: 'ev-1',
      chapterSlug: 'perth'
    }), context);
    expect(firstBatch.jsonBody.progress.failed).toBe(1);
    expect(storage.deleteBadge).not.toHaveBeenCalled();
    const failed = [...mockDeliveries.values()].find(delivery => delivery.status === 'failed');
    const originalOperationId = failed.operationId;
    expect(originalOperationId).toMatch(/^[0-9a-f-]{36}$/);

    await postEventCommunication(request('POST', {
      action: 'retryFailed',
      eventId: 'ev-1',
      chapterSlug: 'perth'
    }), context);
    await postEventCommunication(request('POST', {
      action: 'processBatch',
      eventId: 'ev-1',
      chapterSlug: 'perth'
    }), context);

    const retriedCall = emailService.sendPostEventEmail.mock.calls.find((call, index) => (
      index > 0 && call[0].email === failed.email
    ));
    expect(retriedCall[9]).toBe(originalOperationId);
    expect([...mockDeliveries.values()].find(delivery => delivery.email === failed.email).status).toBe('sent');
  });

  test('treats legacy EventBadges recipients as already contacted', async () => {
    mockBadges.set('ev-1:legacy', {
      partitionKey: 'ev-1',
      rowKey: 'legacy',
      recipientEmail: 'ALICE@example.com'
    });
    const response = await postEventCommunication(request('POST', {
      action: 'start',
      eventId: 'ev-1',
      chapterSlug: 'perth',
      templates: getDefaultTemplates()
    }), context);

    expect(response.jsonBody.progress).toEqual({ total: 2, pending: 1, sent: 1, failed: 0 });
    const alice = [...mockDeliveries.values()].find(delivery => delivery.email === 'alice@example.com');
    expect(alice.status).toBe('sent');
    expect(badgeGenerator.generateSharedEventBadgePng).not.toHaveBeenCalled();
  });
});
