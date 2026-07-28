const mockGetRef = jest.fn();
const mockCreateDispatchEvent = jest.fn();
const mockOctokit = jest.fn().mockImplementation(() => ({
  git: { getRef: mockGetRef },
  repos: { createDispatchEvent: mockCreateDispatchEvent }
}));
const mockCreateAppAuth = jest.fn();
const mockLogAudit = jest.fn();

jest.mock('@octokit/rest', () => ({ Octokit: mockOctokit }));
jest.mock('@octokit/auth-app', () => ({ createAppAuth: mockCreateAppAuth }));
jest.mock('../src/helpers/auditLog', () => ({ logAudit: mockLogAudit }));

const releaseApproval = require('../src/functions/releaseApproval');

const SHA = 'a'.repeat(40);
const context = { log: jest.fn() };

function request(method, roles = ['admin'], body, url = `https://example.com/api/releaseApproval?sha=${SHA}&chapter=perth`) {
  const principal = Buffer.from(JSON.stringify({
    userId: 'admin-id',
    userDetails: 'admin@example.com',
    userRoles: roles,
    identityProvider: 'ciam'
  })).toString('base64');

  return {
    method,
    url,
    headers: {
      get(name) {
        if (name === 'x-ms-client-principal') return principal;
        if (name === 'x-requested-with') return 'fetch';
        return null;
      }
    },
    json: body instanceof Error
      ? jest.fn().mockRejectedValue(body)
      : jest.fn().mockResolvedValue(body || {})
  };
}

describe('releaseApproval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_APP_ID = 'app-id';
    process.env.GITHUB_APP_PRIVATE_KEY = 'private-key';
    process.env.GITHUB_APP_INSTALLATION_ID = 'installation-id';
    process.env.GITHUB_REPO_OWNER = 'Global-Security-Community';
    process.env.GITHUB_REPO_NAME = 'core-website';
    mockGetRef.mockResolvedValue({ data: { object: { sha: SHA } } });
    mockCreateDispatchEvent.mockResolvedValue({});
  });

  test('requires authentication', async () => {
    const req = request('GET');
    req.headers.get = () => null;
    const response = await releaseApproval(req, context);
    expect(response.status).toBe(401);
  });

  test('requires the admin role', async () => {
    const response = await releaseApproval(request('GET', ['authenticated']), context);
    expect(response.status).toBe(403);
  });

  test('renders a confirmation page for a valid request', async () => {
    const response = await releaseApproval(request('GET'), context);
    expect(response.status).toBe(200);
    expect(response.body).toContain('Approve production release');
    expect(response.body).toContain(SHA);
    expect(response.body).toContain('/js/release-approval.js');
    expect(response.headers['Cache-Control']).toBe('private, no-store');
  });

  test('rejects invalid release details', async () => {
    const response = await releaseApproval(
      request('GET', ['admin'], null, 'https://example.com/api/releaseApproval?sha=bad&chapter=Perth!'),
      context
    );
    expect(response.status).toBe(400);
  });

  test('rejects malformed JSON', async () => {
    const response = await releaseApproval(request('POST', ['admin'], new Error('bad json')), context);
    expect(response.status).toBe(400);
    expect(response.jsonBody.error).toBe('Invalid JSON');
  });

  test('rejects approval after main changes', async () => {
    mockGetRef.mockResolvedValueOnce({ data: { object: { sha: 'b'.repeat(40) } } });
    const response = await releaseApproval(
      request('POST', ['admin'], { sha: SHA, chapterSlug: 'perth' }),
      context
    );
    expect(response.status).toBe(409);
    expect(mockCreateDispatchEvent).not.toHaveBeenCalled();
  });

  test('dispatches a SHA-bound release and records the approver', async () => {
    const response = await releaseApproval(
      request('POST', ['admin'], { sha: SHA, chapterSlug: 'perth' }),
      context
    );

    expect(response.status).toBe(202);
    expect(mockGetRef).toHaveBeenCalledWith({
      owner: 'Global-Security-Community',
      repo: 'core-website',
      ref: 'heads/main'
    });
    expect(mockCreateDispatchEvent).toHaveBeenCalledWith({
      owner: 'Global-Security-Community',
      repo: 'core-website',
      event_type: 'release-approved',
      client_payload: {
        expected_sha: SHA,
        chapter_slug: 'perth',
        approved_by: 'authenticated administrator via Discord'
      }
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      'release',
      SHA,
      'production_release_approved',
      'admin@example.com',
      { chapterSlug: 'perth', sha: SHA },
      context
    );
  });

  test('surfaces GitHub dispatch failures', async () => {
    mockCreateDispatchEvent.mockRejectedValueOnce(new Error('dispatch failed'));
    const response = await releaseApproval(
      request('POST', ['admin'], { sha: SHA, chapterSlug: 'perth' }),
      context
    );
    expect(response.status).toBe(500);
    expect(context.log).toHaveBeenCalledWith('releaseApproval error: dispatch failed');
  });
});
