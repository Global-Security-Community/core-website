const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const generate = fs.readFileSync(path.join(root, '.github/workflows/generate-event.yml'), 'utf8');
const validate = fs.readFileSync(path.join(root, '.github/workflows/validate-release-source.yml'), 'utf8');
const deploy = fs.readFileSync(path.join(root, '.github/workflows/azure-static-web-apps-lively-desert-0f1f18c10.yml'), 'utf8');
const validationScript = validate.split('        run: |')[1]
  .split('\n').map(line => line.replace(/^          /, '')).join('\n')
  .replaceAll('/tmp/source-page', '"$SOURCE_PAGE"');
const preflightScript = generate.split('        run: |')[1]
  .split('\n      - name: Checkout repository')[0]
  .split('\n').map(line => line.replace(/^          /, '')).join('\n');

describe('event automation contracts', () => {
  test('serializes events and stages only their generated page', () => {
    expect(generate).toContain('group: generate-event-${{ github.event.client_payload.event_slug }}');
    expect(generate).toContain('ref: main');
    expect(generate).toContain('git add "$EVENT_PATH"');
    expect(generate).not.toContain('git add .');
    expect(generate).toContain('auto/event-${SLUG}-${GITHUB_RUN_ID}');
  });

  describe('publication request preflight', () => {
    let directory;
    let env;
    let payload;

    function run() {
      fs.writeFileSync(env.GITHUB_EVENT_PATH, JSON.stringify({ client_payload: payload }));
      return execFileSync('bash', ['-e', '-c', preflightScript], {
        cwd: directory, env, encoding: 'utf8', stdio: 'pipe'
      });
    }

    beforeEach(() => {
      directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gsc-publication-preflight-'));
      env = {
        ...process.env,
        EVENT_ID: 'event-id',
        SLUG: 'melbourne-event',
        CHAPTER_SLUG: 'melbourne',
        PUBLICATION_ID: '11111111-1111-4111-8111-111111111111',
        GITHUB_ENV: path.join(directory, 'env'),
        GITHUB_EVENT_PATH: path.join(directory, 'event.json')
      };
      payload = { publication: { token: `123456789.${'a'.repeat(64)}` } };
      fs.writeFileSync(env.GITHUB_ENV, '');
    });

    afterEach(() => {
      fs.rmSync(directory, { recursive: true, force: true });
    });

    test('masks callback tokens before making them available to subsequent steps', () => {
      expect(generate).not.toContain('PUBLICATION_TOKEN:');
      expect(generate).toContain('PUBLICATION_ID: ${{ github.event.client_payload.publication.id }}');
      expect(run()).toContain(`::add-mask::${payload.publication.token}`);
      expect(fs.readFileSync(env.GITHUB_ENV, 'utf8')).toBe(
        `PUBLICATION_TOKEN=${payload.publication.token}\nTRACK_PUBLICATION=true\n`
      );
      expect(preflightScript.indexOf('::add-mask::')).toBeLessThan(
        preflightScript.indexOf('echo "PUBLICATION_TOKEN=')
      );
    });

    test('keeps legacy dispatches main-only during rollout', () => {
      env.PUBLICATION_ID = '';
      payload = {};
      expect(run()).toContain('Legacy event dispatch');
      expect(fs.readFileSync(env.GITHUB_ENV, 'utf8')).toBe('TRACK_PUBLICATION=false\n');
    });

    test.each(['id', 'token'])('rejects incomplete tracking with a missing %s', missing => {
      if (missing === 'id') env.PUBLICATION_ID = '';
      else payload = {};
      expect(() => run()).toThrow();
      expect(fs.readFileSync(env.GITHUB_ENV, 'utf8')).toBe('');
    });

    test('rejects invalid identifiers without accepting a valid slug prefix', () => {
      env.SLUG = 'a'.repeat(81);
      expect(() => run()).toThrow();
      env.SLUG = '../another-page';
      expect(() => run()).toThrow();
      expect(fs.readFileSync(env.GITHUB_ENV, 'utf8')).toBe('');
    });
  });

  test('opens an isolated protected production PR from the merged main source', () => {
    expect(generate).toContain('--base live-version-swa');
    expect(generate).toContain('auto/release-event-${SLUG}-${GITHUB_RUN_ID}');
    expect(generate).toContain('git checkout "$SOURCE_SHA" -- "$EVENT_PATH"');
    expect(generate).toContain('<!-- automated-event-release -->');
    expect(generate).toContain('gh pr merge "$PR_NUMBER" --auto --merge');
    expect(generate).not.toContain('git push origin live-version-swa');
  });

  test('recovers unchanged pages and waits for a real production deployment', () => {
    expect(generate).toContain('SOURCE_SHA=$(git log -1 --format=%H -- "$EVENT_PATH")');
    expect(generate).toContain('Redeploy an already released event');
    expect(generate).toContain('--commit "$PRODUCTION_SHA"');
    expect(generate).toContain('--branch live-version-swa');
    expect(generate).toContain('Verify live event and publish notifications');
    expect(generate).toContain("if: (failure() || cancelled()) && env.TRACK_PUBLICATION == 'true'");
    expect(generate).toContain('publicationId: $publicationId');
    expect(generate).toContain('Legacy event dispatch: generating on main only');
  });

  test('delivers every signed callback through Azure and smoke-tests handler authentication', () => {
    const origin = 'https://lively-desert-0f1f18c10.2.azurestaticapps.net/api/eventPublicationResult';
    expect(generate).toContain(`PUBLICATION_RESULT_URL: ${origin}`);
    expect(generate.match(/-X POST "\$PUBLICATION_RESULT_URL"/g)).toHaveLength(3);
    expect(generate).not.toContain('https://globalsecurity.community/api/eventPublicationResult');
    expect(deploy).toContain(`PUBLICATION_RESULT_URL: ${origin}`);
    expect(deploy).toContain('Smoke test - Publication callback');
    expect(deploy).toContain("check_callback '{}' 400 'Invalid publication result'");
    expect(deploy).toContain('check_callback "$PAYLOAD" 403 \'Invalid or expired publication token\'');
  });

  test('registers both endpoints and protects admin progress before the API catch-all', () => {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'staticwebapp.config.json'), 'utf8'));
    const index = config.routes.findIndex(route => route.route === '/api/eventPublication');
    expect(config.routes[index].allowedRoles).toEqual(['admin']);
    expect(index).toBeLessThan(config.routes.findIndex(route => route.route === '/api/*'));
    expect(config.routes.find(route => route.route === '/api/eventPublicationResult').allowedRoles).toEqual(['anonymous']);
    const app = fs.readFileSync(path.join(root, 'api/src/app.js'), 'utf8');
    expect(app).toContain("app.http('eventPublication'");
    expect(app).toContain("app.post('eventPublicationResult'");
  });
});

describe('production source validation', () => {
  let directory;
  let env;
  let sourceSha;
  let pagePath;

  function git(...args) {
    return execFileSync('git', args, { cwd: directory, env, encoding: 'utf8', stdio: 'pipe' }).trim();
  }

  function fixture(kind = 'event', slug = 'melbourne-event') {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gsc-release-test-'));
    env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
    pagePath = `src/${kind === 'event' ? 'events' : 'chapters'}/${slug}/index.md`;
    fs.mkdirSync(path.dirname(path.join(directory, pagePath)), { recursive: true });
    fs.writeFileSync(path.join(directory, pagePath), 'Approved page\n');
    git('init', '-q', '-b', 'main');
    git('config', 'user.name', 'Publication tests');
    git('config', 'user.email', 'publication-tests@example.invalid');
    git('add', 'src');
    git('commit', '-qm', 'Approved source');
    sourceSha = git('rev-parse', 'HEAD');
    git('remote', 'add', 'origin', directory);
    const bin = path.join(directory, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'gh'), '#!/bin/sh\ncat "$FILES_FIXTURE"\n', { mode: 0o755 });
    env = {
      ...env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      SOURCE_PAGE: path.join(directory, 'source-page'),
      FILES_FIXTURE: path.join(directory, 'files.json'),
      GITHUB_REPOSITORY: 'example/repository',
      HEAD_REPO: 'example/repository',
      TARGET_REPO: 'example/repository',
      HEAD_REF: `auto/release-${kind}-${slug}-42`,
      HEAD_SHA: sourceSha,
      PR_NUMBER: '42',
      PR_BODY: `<!-- automated-${kind}-release -->\n<!-- ${kind}-slug:${slug} -->\n<!-- source-main-sha:${sourceSha} -->`
    };
    files([{ filename: pagePath, status: 'added' }]);
  }

  function files(entries) {
    fs.writeFileSync(env.FILES_FIXTURE, JSON.stringify([entries]));
  }

  function run() {
    return execFileSync('bash', ['-e', '-c', validationScript], { cwd: directory, env, encoding: 'utf8', stdio: 'pipe' });
  }

  afterEach(() => {
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
    directory = null;
  });

  test.each(['event', 'chapter'])('accepts exactly the approved %s page', kind => {
    fixture(kind);
    expect(() => run()).not.toThrow();
  });

  test.each(['a', 'a'.repeat(80)])('accepts event slugs at their supported boundaries', slug => {
    fixture('event', slug);
    expect(() => run()).not.toThrow();
  });

  test('rejects overlong or traversal slugs without accepting a valid prefix', () => {
    fixture();
    env.PR_BODY = env.PR_BODY.replace('event-slug:melbourne-event', `event-slug:${'a'.repeat(81)}`);
    expect(() => run()).toThrow();
    env.PR_BODY = env.PR_BODY.replace('a'.repeat(81), '../another-page');
    expect(() => run()).toThrow();
  });

  test('rejects unrelated files and renames, even when the new filename matches', () => {
    fixture();
    files([{ filename: pagePath, status: 'added' }, { filename: 'api/src/app.js', status: 'modified' }]);
    expect(() => run()).toThrow();
    files([{ filename: pagePath, status: 'renamed', previous_filename: 'src/another-page.md' }]);
    expect(() => run()).toThrow();
  });

  test('rejects content that differs from the approved source', () => {
    fixture();
    fs.writeFileSync(path.join(directory, pagePath), 'Unapproved content\n');
    expect(() => run()).toThrow();
  });

  test('rejects source commits that have not merged into main', () => {
    fixture();
    git('checkout', '-qb', 'unapproved');
    fs.writeFileSync(path.join(directory, pagePath), 'Unapproved content\n');
    git('add', pagePath);
    git('commit', '-qm', 'Not merged');
    env.PR_BODY = env.PR_BODY.replace(sourceSha, git('rev-parse', 'HEAD'));
    expect(() => run()).toThrow();
  });

  test('preserves approved exact-SHA releases from main', () => {
    fixture();
    env.HEAD_REF = 'main';
    env.PR_BODY = `<!-- approved-main-sha:${sourceSha} -->`;
    expect(() => run()).not.toThrow();
    env.HEAD_SHA = 'b'.repeat(40);
    expect(() => run()).toThrow();
  });
});
