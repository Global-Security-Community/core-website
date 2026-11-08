process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';
process.env.APPROVAL_TOKEN_SECRET = 'event-publication-test-secret';

const mockEvents = new Map();
const mockCreateEntity = jest.fn();
const mockGetEntity = jest.fn();
const mockUpdateEntity = jest.fn();
const mockDispatch = jest.fn();
const mockSendEmail = jest.fn();
let mockETag = 0;

jest.mock('@azure/data-tables', () => ({
  TableClient: {
    fromConnectionString: jest.fn(() => ({
      createEntity: mockCreateEntity,
      getEntity: mockGetEntity,
      updateEntity: mockUpdateEntity
    }))
  },
  AzureNamedKeyCredential: jest.fn()
}));
jest.mock('../src/helpers/tableStorage', () => ({
  ...jest.requireActual('../src/helpers/tableStorage'),
  getEventBySlug: jest.fn().mockResolvedValue(null),
  getApprovedApplicationBySlug: jest.fn().mockResolvedValue({ city: 'Melbourne' }),
  getSubscriptionsByChapter: jest.fn()
}));
jest.mock('../src/helpers/auth', () => ({
  ...jest.requireActual('../src/helpers/auth'),
  verifyChapterAccess: jest.fn()
}));
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(() => ({ repos: { createDispatchEvent: mockDispatch } }))
}));
jest.mock('@octokit/auth-app', () => ({ createAppAuth: jest.fn() }));
jest.mock('../src/helpers/emailService', () => ({ sendEventNotificationEmail: mockSendEmail }));
jest.mock('../src/helpers/auditLog', () => ({ logAudit: jest.fn() }));
jest.mock('../src/helpers/discordBot', () => ({ sendMessage: jest.fn().mockResolvedValue(true) }));

const storage = require('../src/helpers/tableStorage');
const auth = require('../src/helpers/auth');
const createEvent = require('../src/functions/createEvent');
const eventPublication = require('../src/functions/eventPublication');
const eventPublicationResult = require('../src/functions/eventPublicationResult');
const eventAttendance = require('../src/functions/eventAttendance');
const { eventPublicationResponse } = require('../src/helpers/eventPublication');
const { sendMessage } = require('../src/helpers/discordBot');
const context = { log: jest.fn() };
const originalFetch = global.fetch;
const eventBody = {
  title: 'Melbourne publication test',
  date: '2026-12-01',
  description: '<p>A community event.</p>',
  chapterSlug: 'melbourne',
  locationAddress1: '123 Test Street',
  locationCity: 'Melbourne'
};

function key(chapter, id) {
  return `${chapter}:${id}`;
}

function request(body, { method = 'POST', roles = ['admin'], csrf = true, query = '' } = {}) {
  const headers = new Map();
  if (roles) {
    headers.set('x-ms-client-principal', Buffer.from(JSON.stringify({
      userId: 'publication-test-admin',
      userDetails: 'admin@example.invalid',
      userRoles: roles
    })).toString('base64'));
  }
  if (csrf) headers.set('x-requested-with', 'fetch');
  return {
    method,
    url: `https://example.invalid/api/eventPublication${query}`,
    headers,
    json: async () => body
  };
}

function json(response) {
  return response.jsonBody || JSON.parse(response.body);
}

function resultBody(payload, status = 'published') {
  return {
    eventId: payload.event_id,
    chapterSlug: payload.chapter_slug,
    publicationId: payload.publication.id,
    token: payload.publication.token,
    status,
    runId: '123456',
    ...(status === 'published' ? { productionSha: 'a'.repeat(40) } : {})
  };
}

function pageResponse(html, status = 200, type = 'text/html') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map([['content-type', type]]),
    text: async () => html
  };
}

async function create() {
  const response = await createEvent(request(eventBody), context);
  return {
    response,
    event: json(response).event,
    payload: mockDispatch.mock.calls.at(-1)?.[0].client_payload
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEvents.clear();
  mockETag = 0;
  process.env.GITHUB_APP_ID = 'test-app';
  process.env.GITHUB_APP_PRIVATE_KEY = 'test-key';
  process.env.GITHUB_APP_INSTALLATION_ID = 'test-installation';
  process.env.GITHUB_REPO_OWNER = 'Global-Security-Community';
  process.env.GITHUB_REPO_NAME = 'core-website';
  process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID = '123456';
  mockDispatch.mockReset().mockResolvedValue({});
  mockSendEmail.mockReset().mockResolvedValue({ status: 'Succeeded' });
  auth.verifyChapterAccess.mockReset().mockResolvedValue(true);
  storage.getSubscriptionsByChapter.mockReset().mockResolvedValue([
    { email: 'subscriber-one@example.invalid' },
    { email: 'subscriber-two@example.invalid' }
  ]);
  mockCreateEntity.mockReset().mockImplementation(async entity => {
    mockEvents.set(key(entity.partitionKey, entity.rowKey), { ...entity, etag: String(++mockETag) });
  });
  mockGetEntity.mockReset().mockImplementation(async (chapter, id) => {
    const event = mockEvents.get(key(chapter, id));
    if (!event) throw Object.assign(new Error('Event not found'), { statusCode: 404 });
    return { ...event };
  });
  mockUpdateEntity.mockReset().mockImplementation(async (entity, mode, options = {}) => {
    const eventKey = key(entity.partitionKey, entity.rowKey);
    const current = mockEvents.get(eventKey);
    if (options.etag && options.etag !== current.etag) {
      throw Object.assign(new Error('ETag conflict'), { statusCode: 412 });
    }
    mockEvents.set(eventKey, { ...current, ...entity, etag: String(++mockETag) });
  });
  global.fetch = jest.fn().mockImplementation(async url => {
    const slug = new URL(url).pathname.split('/')[2];
    return pageResponse(`<div class="container event-detail" data-event-slug="${slug}"></div>`);
  });
});

afterEach(() => jest.restoreAllMocks());
afterAll(() => { global.fetch = originalFetch; });

describe('event creation and publication', () => {
  test('stores a draft, queues a signed attempt, and does not email before deployment', async () => {
    const { response, event, payload } = await create();
    expect(response.status).toBe(201);
    expect(event.status).toBe('draft');
    expect(event.publication.status).toBe('queued');
    expect(payload.publication.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(payload.publication.token).toMatch(/^[0-9]+\.[a-f0-9]{64}$/);
    expect(payload.event_description).toBe('A community event.');
    expect(JSON.stringify(event)).not.toContain(payload.publication.token);
    expect(mockSendEmail).not.toHaveBeenCalled();

    const generated = await eventPublicationResult(request(resultBody(payload, 'generated')), context);
    expect(generated.status).toBe(200);
    expect(mockEvents.get(key('melbourne', event.id))).toMatchObject({
      status: 'draft', publicationStatus: 'generated', publicationRunId: '123456'
    });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('keeps the signed dispatch within GitHub client payload limits', async () => {
    const { response, payload } = await create();
    expect(response.status).toBe(201);
    expect(Object.keys(payload).length).toBeLessThanOrEqual(10);
    expect(JSON.stringify(payload).length).toBeLessThanOrEqual(65535);
    expect(Object.keys(payload.publication).sort()).toEqual(['id', 'token']);
  });

  test.each([
    '<html><title>Home | Global Security Community</title></html>',
    '<div class="container event-detail" data-event-slug="another-event"></div>',
    '<script>const data = { "data-event-slug": "melbourne-publication-test" };</script>'
  ])('rejects HTTP 200 content that is not the requested event page', async html => {
    const { event, payload } = await create();
    global.fetch.mockResolvedValue(pageResponse(html));
    const response = await eventPublicationResult(request(resultBody(payload)), context);
    expect(response.status).toBe(409);
    expect(mockEvents.get(key('melbourne', event.id)).status).toBe('draft');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('rejects non-HTML responses and fails explicitly on inaccessible pages', async () => {
    const { event, payload } = await create();
    global.fetch.mockResolvedValueOnce(pageResponse('{}', 200, 'application/json'));
    expect((await eventPublicationResult(request(resultBody(payload)), context)).status).toBe(409);
    global.fetch.mockResolvedValueOnce(pageResponse('Forbidden', 403));
    expect((await eventPublicationResult(request(resultBody(payload)), context)).status).toBe(500);
    expect(mockEvents.get(key('melbourne', event.id)).status).toBe('draft');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('publishes before sending emails and does not repeat emails on replayed callbacks', async () => {
    const { event, payload } = await create();
    mockSendEmail.mockImplementation(async () => {
      expect(mockEvents.get(key('melbourne', event.id))).toMatchObject({
        status: 'published', publicationStatus: 'published'
      });
      return { status: 'Succeeded' };
    });
    const body = resultBody(payload);
    expect((await eventPublicationResult(request(body), context)).status).toBe(200);
    expect(mockEvents.get(key('melbourne', event.id))).toMatchObject({
      status: 'published',
      publicationStatus: 'published',
      publicationNotificationStatus: 'sent',
      publicationProductionSha: 'a'.repeat(40)
    });
    expect(global.fetch.mock.calls[0][0]).toContain(`/events/${event.slug}/?publication=`);
    expect(global.fetch.mock.calls[0][1].method).not.toBe('HEAD');
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect((await eventPublicationResult(request(body), context)).status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await eventPublicationResult(request(resultBody(payload, 'failed')), context);
    expect(mockEvents.get(key('melbourne', event.id)).publicationStatus).toBe('published');
  });

  test('concurrent successful callbacks claim notification delivery only once', async () => {
    const { payload } = await create();
    const responses = await Promise.all([
      eventPublicationResult(request(resultBody(payload)), context),
      eventPublicationResult(request(resultBody(payload)), context)
    ]);
    expect(responses.every(response => response.status === 200)).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
  });

  test('a concurrent event edit cannot revert publication or repeat subscriber emails', async () => {
    const { event, payload } = await create();
    const readEntity = mockGetEntity.getMockImplementation();
    let resumeEdit;
    let readComplete;
    const resume = new Promise(resolve => { resumeEdit = resolve; });
    const read = new Promise(resolve => { readComplete = resolve; });
    mockGetEntity.mockImplementationOnce(async (...args) => {
      const snapshot = await readEntity(...args);
      readComplete();
      await resume;
      return snapshot;
    });
    const edit = storage.updateEvent('melbourne', event.id, { title: 'Edited event title' });
    await read;
    try {
      expect((await eventPublicationResult(request(resultBody(payload)), context)).status).toBe(200);
    } finally {
      resumeEdit();
      await edit;
    }
    expect(mockEvents.get(key('melbourne', event.id))).toMatchObject({
      title: 'Edited event title',
      status: 'published',
      publicationStatus: 'published',
      publicationNotificationStatus: 'sent'
    });
    await eventPublicationResult(request(resultBody(payload)), context);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
  });

  test('notification failures remain visible without failing the published event', async () => {
    const { event, payload } = await create();
    mockSendEmail.mockRejectedValueOnce(new Error('Email service unavailable'));
    const response = await eventPublicationResult(request(resultBody(payload)), context);
    expect(response.status).toBe(200);
    expect(mockEvents.get(key('melbourne', event.id))).toMatchObject({
      publicationStatus: 'published',
      publicationNotificationStatus: 'failed',
      publicationNotificationError: '1 of 2 subscriber notifications failed'
    });
  });

  test('missing subscriber data is logged and does not undo publication', async () => {
    const { event, payload } = await create();
    storage.getSubscriptionsByChapter.mockRejectedValueOnce(new Error('Storage unavailable'));
    expect((await eventPublicationResult(request(resultBody(payload)), context)).status).toBe(200);
    expect(mockEvents.get(key('melbourne', event.id))).toMatchObject({
      publicationStatus: 'published',
      publicationNotificationStatus: 'failed'
    });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('reports dispatch failure with the saved draft and safely retries the same event', async () => {
    mockDispatch.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }));
    const { response, event, payload } = await create();
    expect(response.status).toBe(502);
    expect(json(response).success).toBe(false);
    expect(event.publication).toMatchObject({ status: 'failed', error: 'Forbidden' });
    expect(mockDispatch).toHaveBeenCalledTimes(1);

    const retried = await eventPublication(request({ eventId: event.id, chapterSlug: 'melbourne' }), context);
    expect(retried.status).toBe(202);
    expect(json(retried).event.id).toBe(event.id);
    expect(mockCreateEntity).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[1][0].client_payload.publication.id).not.toBe(payload.publication.id);
    const stale = await eventPublicationResult(request(resultBody(payload, 'generated')), context);
    expect(stale.status).toBe(409);
    expect(mockEvents.get(key('melbourne', event.id)).publicationStatus).toBe('queued');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('reports missing GitHub configuration instead of silently succeeding', async () => {
    delete process.env.GITHUB_APP_ID;
    const { response, event } = await create();
    expect(response.status).toBe(502);
    expect(event.publication.error).toContain('configuration');
    expect(event.status).toBe('draft');
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  test('retries transient dispatch failures, but stops after three attempts', async () => {
    mockDispatch.mockRejectedValue(Object.assign(new Error('Unavailable'), { status: 503 }));
    const { response, event } = await create();
    expect(response.status).toBe(502);
    expect(mockDispatch).toHaveBeenCalledTimes(3);
    expect(event.publication.status).toBe('failed');
  });

  test('does not queue another workflow while an attempt is active', async () => {
    const { event } = await create();
    const response = await eventPublication(request({ eventId: event.id, chapterSlug: 'melbourne' }), context);
    expect(response.status).toBe(200);
    expect(json(response).event.publication.status).toBe('queued');
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  test('concurrent retries queue only one new attempt', async () => {
    mockDispatch.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }));
    const { event } = await create();
    const responses = await Promise.all([
      eventPublication(request({ eventId: event.id, chapterSlug: 'melbourne' }), context),
      eventPublication(request({ eventId: event.id, chapterSlug: 'melbourne' }), context)
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 202]);
    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockCreateEntity).toHaveBeenCalledTimes(1);
  });

  test('rejects invalid saved identifiers before dispatching another workflow', async () => {
    const { event } = await create();
    const stored = mockEvents.get(key('melbourne', event.id));
    mockEvents.set(key('melbourne', event.id), {
      ...stored, slug: '../invalid-event', publicationStatus: 'failed'
    });
    mockDispatch.mockClear();
    const response = await eventPublication(request({ eventId: event.id, chapterSlug: 'melbourne' }), context);
    expect(response.status).toBe(502);
    expect(json(response).event.publication.error).toContain('invalid publication identifiers');
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  test('does not reopen or announce an event closed during deployment', async () => {
    const { event, payload } = await create();
    const stored = mockEvents.get(key('melbourne', event.id));
    mockEvents.set(key('melbourne', event.id), { ...stored, status: 'closed' });
    sendMessage.mockClear();
    expect((await eventPublicationResult(request(resultBody(payload)), context)).status).toBe(200);
    expect(mockEvents.get(key('melbourne', event.id)).status).toBe('closed');
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test('does not re-announce legacy events when their existing pages are recovered', async () => {
    mockEvents.set(key('melbourne', 'legacy-event'), {
      partitionKey: 'melbourne', rowKey: 'legacy-event', chapterSlug: 'melbourne',
      slug: 'legacy-event', title: 'Legacy event', status: 'published', etag: 'legacy'
    });
    const response = await eventPublication(request({ eventId: 'legacy-event', chapterSlug: 'melbourne' }), context);
    expect(response.status).toBe(202);
    const payload = mockDispatch.mock.calls[0][0].client_payload;
    expect((await eventPublicationResult(request(resultBody(payload)), context)).status).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe('publication access and state safety', () => {
  test('requires admin and chapter access, and CSRF protection for retries', async () => {
    const body = { eventId: 'event-id', chapterSlug: 'melbourne' };
    expect((await eventPublication(request(body, { roles: null }), context)).status).toBe(401);
    expect((await eventPublication(request(body, { roles: ['authenticated'] }), context)).status).toBe(403);
    expect((await eventPublication(request(body, { csrf: false }), context)).status).toBe(403);
    auth.verifyChapterAccess.mockResolvedValueOnce(false);
    expect((await eventPublication(request(body), context)).status).toBe(403);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  test('returns JSON errors for malformed input and missing records', async () => {
    expect((await eventPublication(request(null), context)).status).toBe(400);
    expect((await eventPublicationResult(request(null), context)).status).toBe(400);
    const missing = await eventPublication(request({ eventId: 'missing', chapterSlug: 'melbourne' }), context);
    expect(missing.status).toBe(400);
    expect(json(missing).error).toBe('Event not found');
  });

  test('rejects forged and expired callbacks without modifying the event', async () => {
    const { event, payload } = await create();
    const body = resultBody(payload);
    body.token = body.token.slice(0, -1) + (body.token.endsWith('a') ? 'b' : 'a');
    expect((await eventPublicationResult(request(body), context)).status).toBe(403);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 7 * 24 * 60 * 60 * 1000 + 1);
    expect((await eventPublicationResult(request(resultBody(payload)), context)).status).toBe(403);
    expect(mockEvents.get(key('melbourne', event.id)).status).toBe('draft');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('only reports stalled publication at the actual two-hour threshold', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const event = {
      rowKey: 'event-id', publicationStatus: 'queued',
      publicationUpdatedAt: new Date(now - 2 * 60 * 60 * 1000 + 1).toISOString()
    };
    expect(eventPublicationResponse(event).publication.status).toBe('queued');
    event.publicationUpdatedAt = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    expect(eventPublicationResponse(event).publication.status).toBe('stalled');
  });

  test('reclaims a stalled attempt and ignores late queued updates after generation', async () => {
    const { event, payload } = await create();
    await eventPublicationResult(request(resultBody(payload, 'generated')), context);
    const unchanged = await storage.updateEventPublication('melbourne', event.id, payload.publication.id, 'queued');
    expect(unchanged.changed).toBe(false);
    expect(unchanged.event.publicationStatus).toBe('generated');
    const stored = mockEvents.get(key('melbourne', event.id));
    mockEvents.set(key('melbourne', event.id), {
      ...stored, publicationUpdatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    });
    const retried = await eventPublication(request({ eventId: event.id, chapterSlug: 'melbourne' }), context);
    expect(retried.status).toBe(202);
    expect(mockDispatch).toHaveBeenCalledTimes(2);
  });

  test('prevents manual draft publication before the page is verified', async () => {
    const { event } = await create();
    const response = await eventAttendance(request({
      eventId: event.id, chapterSlug: 'melbourne', status: 'published'
    }), context);
    expect(response.status).toBe(409);
    expect(mockEvents.get(key('melbourne', event.id)).status).toBe('draft');
    expect(mockGetEntity).toHaveBeenLastCalledWith('melbourne', event.id);
  });

  test('returns persisted progress and never infers live status from a legacy business status', async () => {
    const { event } = await create();
    const response = await eventPublication(request(null, {
      method: 'GET', query: `?eventId=${event.id}&chapterSlug=melbourne`
    }), context);
    expect(json(response).event.publication.status).toBe('queued');
    expect(eventPublicationResponse({ rowKey: 'legacy', status: 'published' }).publication.status).toBe('untracked');
  });
});
