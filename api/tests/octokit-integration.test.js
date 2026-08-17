/**
 * Tests for Octokit / GitHub App authentication integration.
 * Covers: createAppAuth instantiation, dispatch payloads, getContent/createOrUpdateFileContents,
 * error handling, and missing env vars — across chapterApproval, createEvent, updateChapter.
 */

process.env.DISCORD_CONTACT_CHANNEL_ID = 'test-contact-channel';
process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID = 'test-notif-channel';

// Track Octokit mock calls
const mockCreateDispatchEvent = jest.fn().mockResolvedValue({});
const mockGetContent = jest.fn().mockResolvedValue({
  data: {
    sha: 'abc123',
    content: Buffer.from(
      'latitude: -31.95\nlongitude: 115.86\ndiscord_channel_id: "existing-channel"\ndiscord_guild_id: "existing-guild"\n'
    ).toString('base64')
  }
});
const mockCreateOrUpdateFileContents = jest.fn().mockResolvedValue({});
const mockOctokitConstructor = jest.fn().mockImplementation(() => ({
  repos: {
    createDispatchEvent: mockCreateDispatchEvent,
    getContent: mockGetContent,
    createOrUpdateFileContents: mockCreateOrUpdateFileContents
  }
}));
const mockCreateAppAuth = jest.fn();

jest.mock('@azure/functions', () => ({
  app: { http: jest.fn(), post: jest.fn(), get: jest.fn() }
}));

jest.mock('@octokit/rest', () => ({ Octokit: mockOctokitConstructor }));
jest.mock('@octokit/auth-app', () => ({ createAppAuth: mockCreateAppAuth }));

jest.mock('../src/helpers/tableStorage', () => ({
  storeApplication: jest.fn().mockResolvedValue({}),
  getApplication: jest.fn(),
  updateApplicationStatus: jest.fn().mockResolvedValue({}),
  rejectChapterApplication: jest.fn(),
  claimChapterPublication: jest.fn(),
  updateChapterPublication: jest.fn().mockResolvedValue({}),
  storeEvent: jest.fn().mockResolvedValue({}),
  getEvent: jest.fn(),
  getEventById: jest.fn(),
  getEventBySlug: jest.fn(),
  listEvents: jest.fn().mockResolvedValue([]),
  updateEvent: jest.fn().mockResolvedValue({ status: 'published' }),
  getRegistrationsByEvent: jest.fn().mockResolvedValue([]),
  countRegistrations: jest.fn().mockResolvedValue(0),
  storeRegistration: jest.fn().mockResolvedValue({}),
  getRegistrationsByRole: jest.fn().mockResolvedValue([]),
  isVolunteerOrOrganiserByRegistration: jest.fn().mockResolvedValue(null),
  isVolunteerForAnyEvent: jest.fn().mockResolvedValue(null),
  VALID_ROLES: ['attendee', 'volunteer', 'speaker', 'sponsor', 'organiser'],
  getApprovedApplicationByEmail: jest.fn(),
  getApprovedApplicationsByEmail: jest.fn().mockResolvedValue([{ city: 'Perth' }]),
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
  getPartnersByChapter: jest.fn().mockResolvedValue([]),
  storeContactSubmission: jest.fn().mockResolvedValue({}),
  getUserEmail: jest.fn().mockResolvedValue('admin@test.com')
}));

jest.mock('../src/helpers/discordBot', () => ({
  sendMessage: jest.fn().mockResolvedValue(true),
  createChapterChannel: jest.fn().mockResolvedValue({ channelId: 'ch-123', channelName: 'perth' })
}));

jest.mock('../src/helpers/emailService', () => ({
  sendTicketEmail: jest.fn().mockResolvedValue({}),
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

jest.mock('../src/helpers/imageGenerator', () => ({
  generateChapterBanner: jest.fn().mockResolvedValue('https://mock.blob.url/banner.png'),
  generateChapterShield: jest.fn().mockResolvedValue('https://mock.blob.url/shield.png'),
  generateEventBadgeBackground: jest.fn().mockResolvedValue('https://mock.blob.url/badge.png'),
  callImageApi: jest.fn().mockResolvedValue(Buffer.from('mock')),
  uploadToBlob: jest.fn().mockResolvedValue('https://mock.blob.url/test.png')
}));

jest.mock('../src/helpers/badgeGenerator', () => ({
  generateBadge: jest.fn().mockReturnValue('<svg>mock</svg>'),
  generateBadgePng: jest.fn().mockResolvedValue(Buffer.from('mock-png')),
  generateTextOverlay: jest.fn().mockReturnValue('<svg>overlay</svg>'),
  generateSharedEventBadgePng: jest.fn().mockResolvedValue(Buffer.from('shared-badge'))
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

jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockQR') }));

const storage = require('../src/helpers/tableStorage');
const context = { log: jest.fn() };

function makeAuthRequest(method, body, roles) {
  const principal = {
    userId: 'test-user-id',
    userDetails: 'admin@test.com',
    userRoles: roles || ['admin'],
    identityProvider: 'ciam',
    claims: [
      { typ: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', val: 'admin@test.com' }
    ]
  };
  const encoded = Buffer.from(JSON.stringify(principal)).toString('base64');
  return {
    method,
    url: 'https://globalsecurity.community/api/test',
    headers: { get: (h) => {
      if (h === 'x-ms-client-principal') return encoded;
      if (h === 'x-requested-with') return 'fetch';
      return null;
    }},
    json: () => Promise.resolve(body || {})
  };
}

// ─── GitHub App Environment Setup ──────────────────────────────────

const GITHUB_ENV = {
  GITHUB_APP_ID: 'test-app-id',
  GITHUB_APP_PRIVATE_KEY: 'test-private-key\\nwith-newlines',
  GITHUB_APP_INSTALLATION_ID: 'test-install-id',
  GITHUB_REPO_OWNER: 'Global-Security-Community',
  GITHUB_REPO_NAME: 'core-website'
};

function setGitHubEnv() {
  Object.assign(process.env, GITHUB_ENV);
}

function clearGitHubEnv() {
  Object.keys(GITHUB_ENV).forEach(k => delete process.env[k]);
}

// ─── chapterApproval — Octokit integration ─────────────────────────

describe('chapterApproval — GitHub dispatch integration', () => {
  const chapterApproval = require('../src/functions/chapterApproval');

  function approvalReq(params) {
    const qs = new URLSearchParams(params).toString();
    return {
      method: 'GET',
      url: `https://globalsecurity.community/api/chapterApproval?${qs}`,
      headers: { get: () => null },
      json: () => Promise.resolve({})
    };
  }

  const pendingApplication = {
    status: 'pending',
    city: 'Perth',
    country: 'Australia',
    fullName: 'Alice Smith',
    email: 'alice@test.com',
    linkedIn: 'https://linkedin.com/in/alice',
    github: 'https://github.com/alice',
    secondLeadName: 'Bob Jones',
    secondLeadEmail: 'bob@test.com',
    secondLeadLinkedIn: 'https://linkedin.com/in/bob',
    secondLeadGitHub: 'https://github.com/bob'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearGitHubEnv();
    storage.rejectChapterApplication.mockImplementation(async application => ({
      rejected: application.status === 'pending',
      application: application.status === 'pending'
        ? { ...application, status: 'rejected' }
        : application
    }));
    storage.claimChapterPublication.mockImplementation(async application => {
      if (['dispatching', 'queued', 'published'].includes(application.publicationStatus)) {
      return { claimed: false, application };
      }
      return {
      claimed: true,
      application: {
        ...application,
        status: 'approved',
        publicationStatus: 'dispatching',
        publicationAttempts: Number(application.publicationAttempts || 0) + 1
      }
      };
    });
    storage.updateChapterPublication.mockResolvedValue({});
  });

  test('instantiates Octokit with createAppAuth strategy', async () => {
    setGitHubEnv();
    storage.getApplication.mockResolvedValueOnce({ ...pendingApplication });
    await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'tok' }), context);

    expect(mockOctokitConstructor).toHaveBeenCalledWith({
      authStrategy: mockCreateAppAuth,
      auth: {
        appId: 'test-app-id',
        privateKey: 'test-private-key\nwith-newlines',
        installationId: 'test-install-id'
      }
    });
  });

  test('replaces escaped newlines in private key', async () => {
    setGitHubEnv();
    storage.getApplication.mockResolvedValueOnce({ ...pendingApplication });
    await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'tok' }), context);

    const authConfig = mockOctokitConstructor.mock.calls[0][0].auth;
    expect(authConfig.privateKey).toBe('test-private-key\nwith-newlines');
    expect(authConfig.privateKey).not.toContain('\\n');
  });

  test('sends correct dispatch event type and payload', async () => {
    setGitHubEnv();
    storage.getApplication.mockResolvedValueOnce({ ...pendingApplication });
    await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'tok' }), context);

    expect(mockCreateDispatchEvent).toHaveBeenCalledWith({
      owner: 'Global-Security-Community',
      repo: 'core-website',
      event_type: 'chapter-approved',
      client_payload: expect.objectContaining({
        application_id: 'app-1',
        chapter_city: 'Perth',
        chapter_country: 'Australia',
        chapter_slug: 'perth'
      })
    });
  });

  test('includes privacy-preserving lead data in dispatch payload', async () => {
    setGitHubEnv();
    storage.getApplication.mockResolvedValueOnce({ ...pendingApplication });
    await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'tok' }), context);

    const payload = mockCreateDispatchEvent.mock.calls[0][0].client_payload;
    const leads = JSON.parse(payload.leads);
    expect(leads).toEqual([
      {
        name: 'Alice Smith',
        email_hash: '88502b57e6a1151ca2b5ba83e0e09480',
        linkedin: 'https://linkedin.com/in/alice',
        github: 'https://github.com/alice'
      },
      {
        name: 'Bob Jones',
        email_hash: 'ebf3a1ca1e3ca553e2bd873b3cd96390',
        linkedin: 'https://linkedin.com/in/bob',
        github: 'https://github.com/bob'
      }
    ]);
    expect(payload.leads).not.toContain('alice@test.com');
  });

  test('keeps the repository dispatch payload within GitHub limits', async () => {
    setGitHubEnv();
    storage.getApplication.mockResolvedValueOnce({ ...pendingApplication });
    await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'tok' }), context);

    const payload = mockCreateDispatchEvent.mock.calls[0][0].client_payload;
    expect(Object.keys(payload)).toHaveLength(7);
    expect(Object.keys(payload).length).toBeLessThanOrEqual(10);
  });

  test('generates correct slug from city name (lowercase, no special chars)', async () => {
    setGitHubEnv();
    storage.getApplication.mockResolvedValueOnce({
      ...pendingApplication,
      city: 'Kansas City'
    });
    await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'tok' }), context);

    const payload = mockCreateDispatchEvent.mock.calls[0][0].client_payload;
    expect(payload.chapter_slug).toBe('kansas-city');
  });

  test('includes Discord channel IDs in dispatch payload', async () => {
    setGitHubEnv();
    storage.getApplication.mockResolvedValueOnce({ ...pendingApplication });
    await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'tok' }), context);

    const payload = mockCreateDispatchEvent.mock.calls[0][0].client_payload;
    expect(payload.discord_channel_id).toBe('ch-123');
    expect(payload.notification_channel_id).toBe('test-notif-channel');
  });

  test('skips dispatch when GitHub env vars are missing', async () => {
    clearGitHubEnv();
    storage.getApplication.mockResolvedValueOnce({ ...pendingApplication });
    const res = await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'tok' }), context);

    expect(mockOctokitConstructor).not.toHaveBeenCalled();
    expect(mockCreateDispatchEvent).not.toHaveBeenCalled();
    expect(res.status).toBe(502);
    expect(storage.updateChapterPublication).toHaveBeenCalledWith(
      'app-1',
      'failed',
      expect.objectContaining({ publicationError: expect.stringContaining('configuration') })
    );
  });

  test('records and surfaces a non-retryable dispatch failure', async () => {
    setGitHubEnv();
    storage.getApplication.mockResolvedValueOnce({ ...pendingApplication });
    const error = new Error('Invalid request');
    error.status = 422;
    mockCreateDispatchEvent.mockRejectedValueOnce(error);
    const res = await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'tok' }), context);

    expect(res.status).toBe(502);
    expect(res.body).toContain('Publication Failed');
    expect(storage.updateChapterPublication).toHaveBeenCalledWith(
      'app-1',
      'failed',
      { publicationError: 'Invalid request' }
    );
    expect(context.log).toHaveBeenCalledWith(expect.stringContaining('publication dispatch failed'));
  });

  test('retries transient GitHub dispatch failures', async () => {
    setGitHubEnv();
    storage.getApplication.mockResolvedValueOnce({ ...pendingApplication });
    const error = new Error('GitHub unavailable');
    error.status = 503;
    mockCreateDispatchEvent
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({});

    const res = await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'tok' }), context);

    expect(res.status).toBe(202);
    expect(mockCreateDispatchEvent).toHaveBeenCalledTimes(2);
  });

  test('handles empty optional fields gracefully', async () => {
    setGitHubEnv();
    storage.getApplication.mockResolvedValueOnce({
      status: 'pending', city: 'Perth', country: 'Australia',
      fullName: 'Alice', email: 'alice@test.com'
      // No linkedIn, github, secondLead* fields
    });
    await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'tok' }), context);

    const payload = mockCreateDispatchEvent.mock.calls[0][0].client_payload;
    const leads = JSON.parse(payload.leads);
    expect(leads).toHaveLength(1);
    expect(leads[0].linkedin).toBe('');
    expect(leads[0].github).toBe('');
  });

  test('replays a legacy approved application without publication state', async () => {
    setGitHubEnv();
    storage.getApplication.mockResolvedValueOnce({
      ...pendingApplication,
      status: 'approved'
    });

    const res = await chapterApproval(approvalReq({ id: 'app-1', action: 'approve', token: 'tok' }), context);

    expect(res.status).toBe(202);
    expect(storage.claimChapterPublication).toHaveBeenCalled();
    expect(mockCreateDispatchEvent).toHaveBeenCalledTimes(1);
  });
});

// ─── createEvent — Octokit integration ─────────────────────────────

describe('createEvent — GitHub dispatch integration', () => {
  const createEvent = require('../src/functions/createEvent');

  const validBody = {
    title: 'Test Event',
    date: '2026-09-15',
    location: '123 Main St\nPerth WA',
    description: 'A test event',
    chapterSlug: 'perth',
    registrationCap: '50'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearGitHubEnv();
    storage.getEventBySlug.mockResolvedValue(null);
    storage.getApprovedApplicationBySlug.mockResolvedValue({ city: 'Perth', country: 'Australia' });
  });

  test('instantiates Octokit with createAppAuth strategy', async () => {
    setGitHubEnv();
    const res = await createEvent(makeAuthRequest('POST', validBody, ['admin']), context);
    expect(res.status).toBe(201);

    expect(mockOctokitConstructor).toHaveBeenCalledWith({
      authStrategy: mockCreateAppAuth,
      auth: {
        appId: 'test-app-id',
        privateKey: 'test-private-key\nwith-newlines',
        installationId: 'test-install-id'
      }
    });
  });

  test('sends correct dispatch event type and payload', async () => {
    setGitHubEnv();
    await createEvent(makeAuthRequest('POST', validBody, ['admin']), context);

    expect(mockCreateDispatchEvent).toHaveBeenCalledWith({
      owner: 'Global-Security-Community',
      repo: 'core-website',
      event_type: 'event-created',
      client_payload: expect.objectContaining({
        event_title: 'Test Event',
        event_date: '2026-09-15',
        event_location: '123 Main St\nPerth WA',
        event_description: 'A test event',
        chapter_slug: 'perth',
        event_registration_cap: '50'
      })
    });
  });

  test('includes optional fields with defaults in payload', async () => {
    setGitHubEnv();
    await createEvent(makeAuthRequest('POST', validBody, ['admin']), context);

    const payload = mockCreateDispatchEvent.mock.calls[0][0].client_payload;
    expect(payload.event_sessionize_id).toBe('');
  });

  test('includes sessionizeApiId when provided', async () => {
    setGitHubEnv();
    await createEvent(makeAuthRequest('POST', {
      ...validBody,
      sessionizeApiId: 'sess-123'
    }, ['admin']), context);

    const payload = mockCreateDispatchEvent.mock.calls[0][0].client_payload;
    expect(payload.event_sessionize_id).toBe('sess-123');
  });

  test('skips dispatch when GitHub env vars are missing', async () => {
    clearGitHubEnv();
    const res = await createEvent(makeAuthRequest('POST', validBody, ['admin']), context);
    expect(res.status).toBe(201);
    expect(mockOctokitConstructor).not.toHaveBeenCalled();
  });

  test('continues on dispatch failure (non-critical)', async () => {
    setGitHubEnv();
    mockCreateDispatchEvent.mockRejectedValueOnce(new Error('Network error'));
    const res = await createEvent(makeAuthRequest('POST', validBody, ['admin']), context);

    expect(res.status).toBe(201);
    expect(context.log).toHaveBeenCalledWith(expect.stringContaining('GitHub dispatch failed'));
  });
});

// ─── updateChapter — Octokit integration ───────────────────────────

describe('updateChapter — automated PR dispatch integration', () => {
  const updateChapter = require('../src/functions/updateChapter');

  const validLeads = {
    chapterSlug: 'perth',
    leads: [
      { name: 'Alice Smith', email: 'alice@test.com', github: '', linkedin: '', twitter: '', website: '' },
      { name: 'Bob Jones', email: 'bob@test.com', github: '', linkedin: '', twitter: '', website: '' }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearGitHubEnv();
    storage.getApprovedApplicationBySlug.mockResolvedValue({
      city: 'Perth', country: 'Australia', email: 'admin@test.com',
      discordChannelId: 'ch-123', discordGuildId: 'g-1'
    });
  });

  test('instantiates Octokit with createAppAuth strategy', async () => {
    setGitHubEnv();
    await updateChapter(makeAuthRequest('POST', validLeads, ['admin']), context);

    expect(mockOctokitConstructor).toHaveBeenCalledWith({
      authStrategy: mockCreateAppAuth,
      auth: {
        appId: 'test-app-id',
        privateKey: 'test-private-key\nwith-newlines',
        installationId: 'test-install-id'
      }
    });
  });

  test('calls getContent to retrieve existing file SHA', async () => {
    setGitHubEnv();
    await updateChapter(makeAuthRequest('POST', validLeads, ['admin']), context);

    expect(mockGetContent).toHaveBeenCalledWith({
      owner: 'Global-Security-Community',
      repo: 'core-website',
      path: 'src/chapters/perth/index.md',
      ref: 'main'
    });
  });

  test('dispatches a chapter update with generated markdown', async () => {
    setGitHubEnv();
    await updateChapter(makeAuthRequest('POST', validLeads, ['admin']), context);

    expect(mockCreateDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'Global-Security-Community',
        repo: 'core-website',
        event_type: 'chapter-updated',
        client_payload: expect.objectContaining({
          chapter_slug: 'perth',
          chapter_city: 'Perth',
          chapter_markdown_base64: expect.any(String)
        })
      })
    );
  });

  test('still dispatches when the existing page cannot be read', async () => {
    setGitHubEnv();
    mockGetContent.mockRejectedValueOnce(new Error('Not found'));
    await updateChapter(makeAuthRequest('POST', validLeads, ['admin']), context);

    expect(mockCreateDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'chapter-updated' })
    );
  });

  test('encodes markdown content as base64', async () => {
    setGitHubEnv();
    await updateChapter(makeAuthRequest('POST', validLeads, ['admin']), context);

    const payload = mockCreateDispatchEvent.mock.calls[0][0].client_payload;
    const decoded = Buffer.from(payload.chapter_markdown_base64, 'base64').toString('utf-8');
    expect(decoded).toContain('Perth');
    expect(decoded).toContain('layout:');
    expect(decoded).toContain('latitude: -31.95');
    expect(decoded).not.toContain('alice@test.com');
  });

  test('preserves existing Discord identifiers when storage fields are empty', async () => {
    storage.getApprovedApplicationBySlug.mockResolvedValueOnce({
      city: 'Perth',
      country: 'Australia',
      email: 'admin@test.com',
      discordChannelId: '',
      discordGuildId: ''
    });
    setGitHubEnv();

    await updateChapter(makeAuthRequest('POST', validLeads, ['admin']), context);

    const payload = mockCreateDispatchEvent.mock.calls[0][0].client_payload;
    const decoded = Buffer.from(payload.chapter_markdown_base64, 'base64').toString('utf-8');
    expect(decoded).toContain('discord_channel_id: "existing-channel"');
    expect(decoded).toContain('discord_guild_id: "existing-guild"');
  });

  test('skips GitHub update when env vars are missing', async () => {
    clearGitHubEnv();
    const res = await updateChapter(makeAuthRequest('POST', validLeads, ['admin']), context);
    expect(res.status).toBe(200);
    expect(mockOctokitConstructor).not.toHaveBeenCalled();
    expect(mockGetContent).not.toHaveBeenCalled();
  });

  test('continues when the update workflow cannot be dispatched', async () => {
    setGitHubEnv();
    mockCreateDispatchEvent.mockRejectedValueOnce(new Error('Dispatch failed'));
    const res = await updateChapter(makeAuthRequest('POST', validLeads, ['admin']), context);

    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.pageUpdated).toBe(false);
    expect(body.pageUpdateQueued).toBe(false);
  });

  test('reports that the automated page update was queued', async () => {
    setGitHubEnv();
    const res = await updateChapter(makeAuthRequest('POST', validLeads, ['admin']), context);

    const body = JSON.parse(res.body);
    expect(body.pageUpdated).toBe(true);
    expect(body.pageUpdateQueued).toBe(true);
  });
});

// ─── eventAttendance — status transition validation ────────────────

describe('eventAttendance — status transitions', () => {
  const eventAttendance = require('../src/functions/eventAttendance');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('allows draft → published', async () => {
    storage.getEventById.mockResolvedValueOnce({ status: 'draft' });
    storage.updateEvent.mockResolvedValueOnce({ status: 'published' });
    const res = await eventAttendance(makeAuthRequest('POST', {
      eventId: 'ev-1', chapterSlug: 'perth', status: 'published'
    }, ['admin']), context);
    expect(res.status).toBe(200);
  });

  test('blocks draft → completed', async () => {
    storage.getEventById.mockResolvedValueOnce({ status: 'draft' });
    const res = await eventAttendance(makeAuthRequest('POST', {
      eventId: 'ev-1', chapterSlug: 'perth', status: 'completed'
    }, ['admin']), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toContain('Invalid status transition');
  });

  test('blocks draft → closed', async () => {
    storage.getEventById.mockResolvedValueOnce({ status: 'draft' });
    const res = await eventAttendance(makeAuthRequest('POST', {
      eventId: 'ev-1', chapterSlug: 'perth', status: 'closed'
    }, ['admin']), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toContain('Invalid status transition');
  });

  test('allows published → closed', async () => {
    storage.getEventById.mockResolvedValueOnce({ status: 'published' });
    storage.updateEvent.mockResolvedValueOnce({ status: 'closed' });
    const res = await eventAttendance(makeAuthRequest('POST', {
      eventId: 'ev-1', chapterSlug: 'perth', status: 'closed'
    }, ['admin']), context);
    expect(res.status).toBe(200);
  });

  test('allows published → completed', async () => {
    storage.getEventById.mockResolvedValueOnce({ status: 'published' });
    storage.updateEvent.mockResolvedValueOnce({ status: 'completed' });
    const res = await eventAttendance(makeAuthRequest('POST', {
      eventId: 'ev-1', chapterSlug: 'perth', status: 'completed'
    }, ['admin']), context);
    expect(res.status).toBe(200);
  });

  test('allows closed → completed', async () => {
    storage.getEventById.mockResolvedValueOnce({ status: 'closed' });
    storage.updateEvent.mockResolvedValueOnce({ status: 'completed' });
    const res = await eventAttendance(makeAuthRequest('POST', {
      eventId: 'ev-1', chapterSlug: 'perth', status: 'completed'
    }, ['admin']), context);
    expect(res.status).toBe(200);
  });

  test('allows closed → published (re-open)', async () => {
    storage.getEventById.mockResolvedValueOnce({ status: 'closed' });
    storage.updateEvent.mockResolvedValueOnce({ status: 'published' });
    const res = await eventAttendance(makeAuthRequest('POST', {
      eventId: 'ev-1', chapterSlug: 'perth', status: 'published'
    }, ['admin']), context);
    expect(res.status).toBe(200);
  });

  test('blocks completed → published (re-publish)', async () => {
    storage.getEventById.mockResolvedValueOnce({ status: 'completed' });
    const res = await eventAttendance(makeAuthRequest('POST', {
      eventId: 'ev-1', chapterSlug: 'perth', status: 'published'
    }, ['admin']), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toContain('Invalid status transition');
  });

  test('blocks completed → closed', async () => {
    storage.getEventById.mockResolvedValueOnce({ status: 'completed' });
    const res = await eventAttendance(makeAuthRequest('POST', {
      eventId: 'ev-1', chapterSlug: 'perth', status: 'closed'
    }, ['admin']), context);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toContain('Invalid status transition');
  });

  test('treats event with no status field as draft', async () => {
    storage.getEventById.mockResolvedValueOnce({});
    storage.updateEvent.mockResolvedValueOnce({ status: 'published' });
    const res = await eventAttendance(makeAuthRequest('POST', {
      eventId: 'ev-1', chapterSlug: 'perth', status: 'published'
    }, ['admin']), context);
    expect(res.status).toBe(200);
  });

  test('allows status update when event not found (new event)', async () => {
    storage.getEventById.mockResolvedValueOnce(null);
    storage.updateEvent.mockResolvedValueOnce({ status: 'published' });
    const res = await eventAttendance(makeAuthRequest('POST', {
      eventId: 'ev-1', chapterSlug: 'perth', status: 'published'
    }, ['admin']), context);
    expect(res.status).toBe(200);
  });
});
