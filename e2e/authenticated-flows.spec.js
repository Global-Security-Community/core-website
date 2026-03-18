const { test, expect } = require('@playwright/test');
const { mockLogin, docScreenshot } = require('./helpers');

test.describe('Authenticated Flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockLogin(page);
  });

  test('dashboard loads after login', async ({ page }) => {
    await page.goto('/dashboard/');
    await expect(page.locator('body')).not.toContainText('Azure Static Web Apps Auth', { timeout: 10000 });
    await expect(page.locator('#dash-user')).toBeVisible();
    await docScreenshot(page, '10-dashboard');
  });

  test('dashboard shows event management buttons', async ({ page }) => {
    await page.goto('/dashboard/');
    await page.waitForTimeout(2000);
    await expect(page.locator('#btn-events')).toBeVisible();
    await expect(page.locator('#btn-create')).toBeVisible();
    await expect(page.locator('#btn-chapter')).toBeVisible();
    await docScreenshot(page, '10b-dashboard-nav');
  });

  test('dashboard loads event list from API', async ({ page }) => {
    await page.goto('/dashboard/');
    await page.waitForTimeout(3000);
    const eventsList = page.locator('#events-list');
    await expect(eventsList).toBeVisible();
    await docScreenshot(page, '10c-dashboard-events');
  });

  test('my tickets page loads', async ({ page }) => {
    await page.goto('/my-tickets/');
    await expect(page.locator('h1')).toContainText(/my tickets/i);
    await expect(page.locator('#tickets-list')).toBeVisible();
    await page.waitForTimeout(2000);
    await docScreenshot(page, '11-my-tickets');
  });

  test('event registration page loads with event details', async ({ page }) => {
    await page.goto('/register/?event=global-security-bootcamp-perth-2025');
    await expect(page.locator('h1')).toContainText(/register/i);
    await page.waitForSelector('#event-info .card', { timeout: 10000 }).catch(() => {});
    await docScreenshot(page, '12-register-event');
  });

  test('registration form shows all required fields', async ({ page }) => {
    await page.goto('/register/?event=global-security-bootcamp-perth-2025');
    await page.waitForSelector('#event-info .card', { timeout: 10000 }).catch(() => {});
    // Form only appears if event is open and has capacity
    const formWrap = page.locator('#reg-form-wrap');
    if (await formWrap.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(page.locator('#reg-name')).toBeVisible();
      await expect(page.locator('#reg-email')).toBeVisible();
      await docScreenshot(page, '12b-register-form');
    }
  });

  test('registration form has volunteer interest with two-step confirmation', async ({ page }) => {
    await page.goto('/register/?event=global-security-bootcamp-perth-2025');
    await page.waitForSelector('#reg-form-wrap', { timeout: 10000 }).catch(() => {});
    const volCheckbox = page.locator('#reg-volunteer-interest');
    if (await volCheckbox.isVisible()) {
      // Step 1: Check volunteer interest - confirmation section should appear
      await volCheckbox.check();
      const confirmBox = page.locator('#volunteer-confirm');
      await expect(confirmBox).toBeVisible();
      await docScreenshot(page, '13a-volunteer-step1');

      // Step 2: Confirm availability
      const confirmCheckbox = page.locator('#reg-volunteer-confirm');
      await confirmCheckbox.check();
      await docScreenshot(page, '13b-volunteer-step2');

      // Uncheck volunteer interest - confirmation should hide
      await volCheckbox.uncheck();
      await expect(confirmBox).not.toBeVisible();
    }
  });

  test('scanner page loads for admin/volunteer', async ({ page }) => {
    await page.goto('/scanner/');
    await expect(page.locator('h1')).toBeVisible();
    await docScreenshot(page, '14-scanner');
  });
});

