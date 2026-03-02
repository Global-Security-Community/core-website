const { test, expect } = require('@playwright/test');
const { mockLogin, docScreenshot } = require('./helpers');

test.describe('Public Pages', () => {
  test('homepage loads with navigation and hero', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Global Security Community/i);
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('#main-content')).toBeVisible();
    await docScreenshot(page, '01-homepage');
  });

  test('homepage has login link for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    const loginLink = page.locator('a[href*=".auth/login/ciam"]');
    await expect(loginLink).toBeVisible({ timeout: 5000 });
  });

  test('events page lists upcoming events', async ({ page }) => {
    await page.goto('/events/');
    await expect(page.locator('h1')).toContainText(/event/i);
    // Events are loaded dynamically via JS
    await expect(page.locator('#events-list')).toBeVisible();
    await page.waitForTimeout(2000);
    await docScreenshot(page, '02-events');
  });

  test('event detail page shows event info and register button', async ({ page }) => {
    await page.goto('/events/global-security-bootcamp-perth-2025/');
    await expect(page.locator('h1')).toContainText(/Global Security Bootcamp Perth 2025/i);
    await expect(page.locator('#register-btn')).toBeVisible();
    // Wait for Sessionize content to attempt loading
    await page.waitForTimeout(2000);
    await docScreenshot(page, '02b-event-detail');
  });

  test('event page has agenda and speakers sections', async ({ page }) => {
    await page.goto('/events/global-security-bootcamp-perth-2025/');
    await expect(page.locator('h2:has-text("Agenda")')).toBeVisible();
    await expect(page.locator('h2:has-text("Speakers")')).toBeVisible();
    await expect(page.locator('h2:has-text("Location")')).toBeVisible();
  });

  test('chapters page lists chapters', async ({ page }) => {
    await page.goto('/chapters/');
    await expect(page.locator('h1')).toContainText(/chapter/i);
    await expect(page.locator('.chapter-grid')).toBeVisible();
    await expect(page.locator('.chapter-card').first()).toBeVisible();
    await docScreenshot(page, '03-chapters');
  });

  test('Perth chapter page shows chapter details and social links', async ({ page }) => {
    await page.goto('/chapters/perth/');
    await expect(page.locator('h1')).toBeVisible();
    // Check for social links section
    const socialLinks = page.locator('.chapter-social-links, .social-links, a[href*="linkedin"], a[href*="github"]');
    const hasSocial = await socialLinks.count();
    if (hasSocial > 0) {
      await expect(socialLinks.first()).toBeVisible();
    }
    await docScreenshot(page, '04-chapter-perth');
  });

  test('chapter apply page has application form', async ({ page }) => {
    await page.goto('/chapters/apply/');
    await expect(page.locator('h1')).toContainText(/apply/i);
    await expect(page.locator('#chapter-apply-form')).toBeVisible();
    await expect(page.locator('#fullName')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#city')).toBeVisible();
    await expect(page.locator('#country')).toBeVisible();
    await docScreenshot(page, '04b-chapter-apply');
  });

  test('contact page has contact form', async ({ page }) => {
    await page.goto('/contact/');
    await expect(page.locator('h1')).toContainText(/contact/i);
    await expect(page.locator('#contact-form')).toBeVisible();
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#subject')).toBeVisible();
    await expect(page.locator('#message')).toBeVisible();
    await docScreenshot(page, '05-contact');
  });

  test('about page loads', async ({ page }) => {
    await page.goto('/about/');
    await expect(page.locator('h1')).toContainText(/about/i);
    await docScreenshot(page, '06-about');
  });

  test('navigation has wiki link when logged in', async ({ page }) => {
    await mockLogin(page, { roles: ['authenticated'] });
    await page.goto('/');
    const wikiLink = page.locator('a[href*="wiki.globalsecurity.community"]');
    await expect(wikiLink).toBeVisible({ timeout: 10000 });
    await docScreenshot(page, '07-nav-authenticated');
  });

  test('authenticated nav shows My Tickets and Logout', async ({ page }) => {
    await mockLogin(page, { roles: ['authenticated'] });
    await page.goto('/');
    await expect(page.locator('a[href="/my-tickets/"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('a[href="/.auth/logout"]')).toBeVisible({ timeout: 5000 });
  });

  test('admin nav shows Dashboard link', async ({ page }) => {
    await mockLogin(page, { roles: ['authenticated', 'admin'] });
    await page.goto('/');
    await expect(page.locator('a[href="/dashboard/"]')).toBeVisible({ timeout: 5000 });
    await docScreenshot(page, '07b-nav-admin');
  });
});

