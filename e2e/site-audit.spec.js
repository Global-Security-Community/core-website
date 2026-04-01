/**
 * Full site audit: tests every unauthenticated page, link, button, and form.
 * Also captures screenshots and notes UX/visual issues.
 */
const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:4280';

// All public pages to audit
const PUBLIC_PAGES = [
  { path: '/', name: 'Homepage' },
  { path: '/events/', name: 'Events listing' },
  { path: '/events/global-security-bootcamp-perth-2025/', name: 'Event detail (Perth)' },
  { path: '/chapters/', name: 'Chapters listing' },
  { path: '/chapters/perth/', name: 'Chapter detail (Perth)' },
  { path: '/chapters/apply/', name: 'Chapter application' },
  { path: '/contact/', name: 'Contact page' },
  { path: '/about/', name: 'About page' },
];

test.describe('Full Site Audit — Public Pages', () => {

  for (const page of PUBLIC_PAGES) {
    test(`${page.name} (${page.path}) loads correctly`, async ({ page: p }) => {
      const response = await p.goto(BASE + page.path, { waitUntil: 'networkidle' });
      expect(response.status()).toBe(200);

      // Check no broken images
      const images = await p.locator('img').all();
      for (const img of images) {
        const src = await img.getAttribute('src');
        if (src && !src.startsWith('data:')) {
          const natural = await img.evaluate(el => el.naturalWidth);
          if (natural === 0) {
            console.log(`  ⚠️ BROKEN IMAGE on ${page.path}: ${src}`);
          }
        }
      }

      // Check page title exists
      const title = await p.title();
      expect(title).toBeTruthy();

      // Screenshot
      await p.screenshot({ path: `e2e/audit-screenshots/${page.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`, fullPage: true });
    });
  }
});

test.describe('Navigation Links Audit', () => {

  test('All nav links in header resolve to valid pages', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    const navLinks = await page.locator('nav a, header a').all();
    const results = [];
    for (const link of navLinks) {
      const href = await link.getAttribute('href');
      const text = (await link.textContent()).trim();
      if (!href || href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) continue;
      const url = href.startsWith('http') ? href : BASE + href;
      // Only test internal links
      if (!url.startsWith(BASE) && !url.startsWith('/')) continue;
      try {
        const res = await page.request.get(url.startsWith('/') ? BASE + url : url);
        const status = res.status();
        results.push({ text, href, status });
        if (status >= 400) {
          console.log(`  ❌ NAV LINK BROKEN: "${text}" → ${href} (${status})`);
        }
      } catch (e) {
        results.push({ text, href, status: 'error' });
        console.log(`  ❌ NAV LINK ERROR: "${text}" → ${href} (${e.message})`);
      }
    }
    console.log(`  Checked ${results.length} nav links`);
  });

  test('All links on homepage resolve', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    const links = await page.locator('a[href]').all();
    const checked = new Set();
    const broken = [];
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (!href || href.startsWith('#') || href.toLowerCase().startsWith('javascript:') || href.toLowerCase().startsWith('mailto:')) continue;
      const url = href.startsWith('http') ? href : BASE + href;
      if (!url.startsWith(BASE)) continue; // skip external
      if (checked.has(url)) continue;
      checked.add(url);
      try {
        const res = await page.request.get(url);
        if (res.status() >= 400) {
          broken.push({ href, status: res.status() });
          console.log(`  ❌ BROKEN: ${href} (${res.status()})`);
        }
      } catch (e) {
        broken.push({ href, status: 'error' });
      }
    }
    console.log(`  Checked ${checked.size} unique links, ${broken.length} broken`);
  });
});

test.describe('Events Page Audit', () => {

  test('Events page shows event cards', async ({ page }) => {
    await page.goto(BASE + '/events/', { waitUntil: 'networkidle' });
    // Wait for JS to load events
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/audit-screenshots/events-loaded.png', fullPage: true });

    const content = await page.textContent('body');
    console.log(`  Events page content length: ${content.length}`);
    // Check for event data or "no events" message
    const hasEvents = content.includes('Bootcamp') || content.includes('No upcoming');
    console.log(`  Has events content: ${hasEvents}`);
  });

  test('Event detail page shows all sections', async ({ page }) => {
    await page.goto(BASE + '/events/global-security-bootcamp-perth-2025/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/audit-screenshots/event-detail-loaded.png', fullPage: true });

    // Check key sections exist
    const hasTitle = await page.locator('h1').count();
    const hasRegButton = await page.locator('#register-btn').count();
    const hasLocation = await page.textContent('body').then(t => t.includes('Location'));

    console.log(`  Title: ${hasTitle > 0 ? '✅' : '❌'}`);
    console.log(`  Register button: ${hasRegButton > 0 ? '✅' : '❌'}`);
    console.log(`  Location section: ${hasLocation ? '✅' : '❌'}`);

    // Check if Sessionize loaded (agenda/speakers)
    const agendaEl = await page.locator('#sessionize-agenda').textContent().catch(() => '');
    const speakersEl = await page.locator('#sessionize-speakers').textContent().catch(() => '');
    console.log(`  Agenda: ${agendaEl.includes('Loading') ? '⏳ Still loading' : agendaEl.length > 50 ? '✅ Loaded' : '⚠️ ' + agendaEl.substring(0, 50)}`);
    console.log(`  Speakers: ${speakersEl.includes('Loading') ? '⏳ Still loading' : speakersEl.length > 50 ? '✅ Loaded' : '⚠️ ' + speakersEl.substring(0, 50)}`);

    // Check community partners section
    const partnersVisible = await page.locator('#community-partners').isVisible().catch(() => false);
    console.log(`  Community partners: ${partnersVisible ? '✅ Visible' : 'ℹ️ Hidden (none added yet)'}`);

    // Registration count
    const regCount = await page.locator('#reg-count').textContent().catch(() => '');
    console.log(`  Registration count: ${regCount || '⚠️ Not loaded'}`);
  });
});

test.describe('Chapter Page Audit', () => {

  test('Chapters listing shows chapter cards', async ({ page }) => {
    await page.goto(BASE + '/chapters/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/audit-screenshots/chapters-loaded.png', fullPage: true });
    const content = await page.textContent('body');
    console.log(`  Has Perth chapter: ${content.includes('Perth')}`);
  });

  test('Perth chapter page shows all sections', async ({ page }) => {
    await page.goto(BASE + '/chapters/perth/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/audit-screenshots/chapter-perth-loaded.png', fullPage: true });

    const hasTitle = await page.locator('h1').textContent().catch(() => '');
    const hasLeads = await page.locator('.leads-grid').count();
    const hasBanner = await page.locator('#chapter-banner').isVisible().catch(() => false);
    const hasSubscribe = await page.locator('#subscribe-card').isVisible().catch(() => false);
    const hasEvents = await page.locator('#chapter-events').textContent().catch(() => '');

    console.log(`  Title: ${hasTitle}`);
    console.log(`  Leads grid: ${hasLeads > 0 ? '✅' : '❌'}`);
    console.log(`  Banner: ${hasBanner ? '✅ Visible' : '⚠️ Not visible'}`);
    console.log(`  Subscribe card: ${hasSubscribe ? '✅ Visible' : '⚠️ Not visible'}`);
    console.log(`  Events section: ${hasEvents.length > 20 ? '✅' : '⚠️ ' + hasEvents.substring(0, 50)}`);

    // Check subscribe button state
    const btnText = await page.locator('#btn-subscribe').textContent().catch(() => 'NOT FOUND');
    const loginHint = await page.locator('#subscribe-login-hint').isVisible().catch(() => false);
    console.log(`  Subscribe button: "${btnText}"`);
    console.log(`  Login hint visible: ${loginHint}`);
  });
});

test.describe('Forms Audit', () => {

  test('Contact form has all fields and submits', async ({ page }) => {
    await page.goto(BASE + '/contact/', { waitUntil: 'networkidle' });

    const nameField = await page.locator('#name').count();
    const emailField = await page.locator('#email').count();
    const subjectField = await page.locator('#subject').count();
    const messageField = await page.locator('#message').count();
    const submitBtn = await page.locator('button[type="submit"]').count();

    console.log(`  Name field: ${nameField ? '✅' : '❌'}`);
    console.log(`  Email field: ${emailField ? '✅' : '❌'}`);
    console.log(`  Subject field: ${subjectField ? '✅' : '❌'}`);
    console.log(`  Message field: ${messageField ? '✅' : '❌'}`);
    console.log(`  Submit button: ${submitBtn ? '✅' : '❌'}`);

    // Test client-side validation (submit empty form)
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(500);
    const msg = await page.locator('#form-message').textContent().catch(() => '');
    console.log(`  Empty submit validation: ${msg ? '✅ ' + msg : '⚠️ No validation message'}`);

    await page.screenshot({ path: 'e2e/audit-screenshots/contact-form.png', fullPage: true });
  });

  test('Chapter apply form has all fields', async ({ page }) => {
    await page.goto(BASE + '/chapters/apply/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'e2e/audit-screenshots/chapter-apply.png', fullPage: true });

    const fields = ['fullName', 'email', 'city', 'country', 'whyLead'];
    for (const f of fields) {
      const count = await page.locator(`#${f}`).count();
      console.log(`  Field #${f}: ${count ? '✅' : '❌'}`);
    }
  });
});

test.describe('Visual & UX Review', () => {

  test('Homepage hero and call-to-action', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    // Check hero section
    const h1 = await page.locator('h1').first().textContent().catch(() => '');
    console.log(`  Hero heading: "${h1}"`);

    // Check CTA buttons
    const ctaLinks = await page.locator('.hero a, .cta a, a.btn, a[class*="button"]').all();
    console.log(`  CTA buttons found: ${ctaLinks.length}`);
    for (const link of ctaLinks) {
      const text = (await link.textContent()).trim();
      const href = await link.getAttribute('href');
      console.log(`    → "${text}" → ${href}`);
    }

    // Mobile viewport screenshot
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/audit-screenshots/homepage-mobile.png', fullPage: true });
    console.log(`  Mobile screenshot captured`);

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Check CSS custom properties loaded', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    const teal = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-primary-teal').trim());
    const navy = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-primary-navy').trim());
    console.log(`  --color-primary-teal: ${teal || '⚠️ NOT SET'}`);
    console.log(`  --color-primary-navy: ${navy || '⚠️ NOT SET'}`);
  });

  test('Footer exists on all pages', async ({ page }) => {
    for (const pg of PUBLIC_PAGES) {
      await page.goto(BASE + pg.path, { waitUntil: 'domcontentloaded' });
      const footer = await page.locator('footer').count();
      if (!footer) console.log(`  ⚠️ No <footer> on ${pg.path}`);
    }
    console.log(`  Footer check complete for ${PUBLIC_PAGES.length} pages`);
  });
});
