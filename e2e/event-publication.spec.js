const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const siteRoot = path.resolve(__dirname, '../_site');
const slug = 'melbourne-publication-test';

async function dashboard(page, options = {}) {
  const state = {
    created: false,
    createStatus: options.failed ? 502 : 201,
    progressStatus: 200,
    createRequests: 0,
    progressRequests: 0,
    retryRequests: [],
    statusUpdates: [],
    pageRequests: [],
    event: {
      id: '11111111-1111-4111-8111-111111111111',
      slug,
      title: options.title || 'Melbourne publication test',
      chapterSlug: 'melbourne',
      status: 'draft',
      date: '2026-12-01',
      location: 'Melbourne',
      registrationCount: 0,
      publication: {
        status: options.failed ? 'failed' : 'queued',
        error: options.error || (options.failed ? 'GitHub publication could not be started.' : ''),
        generatedAt: '',
        notificationStatus: 'pending',
        runUrl: ''
      }
    }
  };
  await page.clock.install({ time: new Date('2026-11-01T03:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-01T03:00:01Z'));
  await page.route('http://localhost:4280/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const file = path.join(siteRoot, pathname, pathname.endsWith('/') ? 'index.html' : '');
    if (!file.startsWith(siteRoot + path.sep) || !fs.existsSync(file)) {
      await route.fulfill({ status: 404, body: 'Not found' });
      return;
    }
    if (pathname === '/dashboard/') {
      // Only the test document drops SRI so mocked CDN libraries can load.
      const html = fs.readFileSync(file, 'utf8').replace(/ integrity="[^"]*"/g, '');
      await route.fulfill({ contentType: 'text/html', body: html });
    } else {
      await route.fulfill({ path: file });
    }
  });
  await page.route('https://cdn.jsdelivr.net/**', async route => {
    if (route.request().url().includes('/quill.js')) {
      await route.fulfill({
        contentType: 'text/javascript',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: `window.Quill = class {
          constructor(selector) {
            this.root = document.querySelector(selector);
            this.root.contentEditable = 'true';
          }
          getText() { return this.root.textContent; }
          setText(text) { this.root.textContent = text; }
        };`
      });
    } else if (route.request().url().includes('purify.min.js')) {
      await route.fulfill({
        contentType: 'text/javascript',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: 'window.DOMPurify = { sanitize: function(value) { return value; } };'
      });
    } else {
      await route.fulfill({ contentType: 'text/css', headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
    }
  });
  await page.route('**/.auth/me', async route => {
    await route.fulfill({ json: {
      clientPrincipal: {
        userId: 'publication-test-admin',
        userDetails: 'admin@example.invalid',
        userRoles: ['authenticated', 'admin']
      }
    } });
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/createEvent') {
      state.createRequests++;
      state.created = true;
      await route.fulfill({
        status: state.createStatus,
        json: { event: options.malformedCreate ? { ...state.event, publication: undefined } : state.event }
      });
    } else if (url.pathname === '/api/eventPublication') {
      if (request.method() === 'POST') {
        state.retryRequests.push(request.postDataJSON());
        state.event.publication.status = 'queued';
        state.event.publication.error = '';
        await route.fulfill({ status: 202, json: { event: state.event } });
      } else {
        state.progressRequests++;
        await route.fulfill({
          status: state.progressStatus,
          json: state.progressStatus === 200 ? { event: state.event } : { error: 'Progress unavailable' }
        });
      }
    } else if (url.pathname === '/api/eventAttendance') {
      if (request.method() === 'POST') {
        state.statusUpdates.push(request.postDataJSON());
        await route.fulfill({ json: { success: true } });
      } else if (url.searchParams.get('action') === 'list') {
        await route.fulfill({ json: { events: state.created ? [state.event] : [], chapterCity: 'Melbourne' } });
      } else {
        await route.fulfill({ json: {
          eventId: state.event.id, eventStatus: state.event.status, eventDate: state.event.date,
          publication: state.event.publication, total: 0, checkedIn: 0, attendees: []
        } });
      }
    } else {
      await route.fulfill({ json: { events: [], partners: {}, attendees: [], entries: [] } });
    }
  });
  await page.route(`**/events/${slug}/`, async route => {
    state.pageRequests.push(route.request().method());
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Home | Global Security Community</title>' });
  });
  await page.goto('/dashboard/#create');
  await expect(page.locator('#ev-chapter')).toHaveValue('melbourne');
  await page.locator('#ev-title').fill(state.event.title);
  await page.locator('#ev-date').fill(state.event.date);
  await page.locator('#ev-address1').fill('123 Test Street');
  await page.locator('#ev-description-editor').fill('A community event.');
  await page.locator('#create-btn').click();
  await expect(page.locator('#create-progress')).toBeVisible();
  return state;
}

async function nextPoll(page, state) {
  const previous = state.progressRequests;
  await page.clock.runFor(5100);
  await expect.poll(() => state.progressRequests).toBeGreaterThan(previous);
}

test('a homepage fallback cannot make an event appear live', async ({ page }) => {
  const state = await dashboard(page);
  await expect(page.locator('#step-page')).toHaveClass(/active/);
  await page.clock.runFor(20000);
  await expect(page.locator('#step-page')).toHaveClass(/active/);
  await expect(page.locator('#step-live')).toHaveClass(/pending/);
  await expect(page.locator('#create-progress-link')).toBeHidden();
  expect(state.pageRequests).toEqual([]);
  expect(state.statusUpdates).toEqual([]);
});

test('shows generated and live only when the backend confirms those stages', async ({ page }) => {
  const state = await dashboard(page);
  await expect.poll(() => state.progressRequests).toBeGreaterThan(0);
  state.event.publication.status = 'generated';
  state.event.publication.generatedAt = new Date().toISOString();
  await nextPoll(page, state);
  await expect(page.locator('#step-page')).toHaveClass(/done/);
  await expect(page.locator('#step-live')).toHaveClass(/active/);
  await expect(page.locator('#create-progress-link')).toBeHidden();
  state.event.publication.status = 'published';
  state.event.publication.notificationStatus = 'sent';
  state.event.status = 'published';
  await nextPoll(page, state);
  await expect(page.locator('#step-live')).toHaveClass(/done/);
  await expect(page.locator('#create-progress-link')).toHaveAttribute('href', `/events/${slug}/`);
  await expect(page.locator('#create-progress-link')).toBeVisible();
  expect(state.statusUpdates).toEqual([]);
});

test('retains a failed saved event and retries publication without creating a duplicate', async ({ page }) => {
  const state = await dashboard(page, { failed: true });
  await expect(page.locator('#step-page')).toHaveClass(/error/);
  await expect(page.locator('.pipeline-note')).toContainText('could not be started');
  await page.locator('#create-publication-retry-btn').click();
  await expect(page.locator('#step-page')).toHaveClass(/active/);
  expect(state.retryRequests).toEqual([{ eventId: state.event.id, chapterSlug: 'melbourne' }]);
  expect(state.createRequests).toBe(1);
});

test('reports deployment failure after generation and exposes the workflow link', async ({ page }) => {
  const state = await dashboard(page);
  await expect.poll(() => state.progressRequests).toBeGreaterThan(0);
  state.event.publication.status = 'generated';
  state.event.publication.generatedAt = new Date().toISOString();
  await nextPoll(page, state);
  await expect(page.locator('#step-page')).toHaveClass(/done/);
  state.event.publication.status = 'failed';
  state.event.publication.error = 'Production deployment failed.';
  state.event.publication.runUrl = 'https://github.com/Global-Security-Community/core-website/actions/runs/123456';
  await nextPoll(page, state);
  await expect(page.locator('#step-page')).toHaveClass(/done/);
  await expect(page.locator('#step-live')).toHaveClass(/error/);
  await expect(page.locator('#create-workflow-link')).toHaveAttribute('href', state.event.publication.runUrl);
  await expect(page.locator('#create-publication-retry-btn')).toBeVisible();
  await expect(page.locator('#create-progress-link')).toBeHidden();
});

test('progress request failures are recoverable without re-queueing publication', async ({ page }) => {
  const state = await dashboard(page);
  await expect.poll(() => state.progressRequests).toBeGreaterThan(0);
  state.progressStatus = 500;
  await nextPoll(page, state);
  await expect(page.locator('#create-publication-retry-btn')).toHaveText('Check progress');
  await expect(page.locator('#create-progress-link')).toBeHidden();
  state.progressStatus = 200;
  state.event.publication.status = 'generated';
  await page.locator('#create-publication-retry-btn').click();
  await expect(page.locator('#step-page')).toHaveClass(/done/);
  expect(state.retryRequests).toEqual([]);
});

test('an incomplete saved-event response can recover by checking real progress', async ({ page }) => {
  const state = await dashboard(page, { malformedCreate: true });
  await expect(page.locator('#create-publication-retry-btn')).toHaveText('Check progress');
  await expect(page.locator('#step-live')).toHaveClass(/pending/);
  await page.locator('#create-publication-retry-btn').click();
  await expect(page.locator('#step-page')).toHaveClass(/active/);
  await expect(page.locator('#create-publication-retry-btn')).toBeHidden();
  expect(state.progressRequests).toBeGreaterThan(0);
  expect(state.retryRequests).toEqual([]);
  expect(state.createRequests).toBe(1);
});

test('a draft event opens publication progress instead of manually setting published status', async ({ page }) => {
  const state = await dashboard(page);
  await page.locator('#btn-events').click();
  await page.locator('.event-card').click();
  await expect(page.locator('#btn-publish')).toHaveText('View publication progress');
  await page.locator('#btn-publish').click();
  await expect(page.locator('#create-progress')).toBeVisible();
  await expect(page.locator('#step-live')).toHaveClass(/pending/);
  expect(state.retryRequests).toEqual([]);
  expect(state.statusUpdates).toEqual([]);
});

for (const viewport of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  test(`publication errors wrap and remain usable on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await dashboard(page, { failed: true, title: 'M'.repeat(200), error: 'E'.repeat(500) });
    await expect(page.locator('#create-publication-retry-btn')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: testInfo.outputPath(`publication-${viewport.name}.png`), fullPage: true });
  });
}
