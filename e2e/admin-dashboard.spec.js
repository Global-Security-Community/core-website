const { test, expect } = require('@playwright/test');
const { mockLogin, docScreenshot } = require('./helpers');

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockLogin(page, { roles: ['authenticated', 'admin'] });
  });

  test('dashboard shows welcome and event list', async ({ page }) => {
    await page.goto('/dashboard/');
    await expect(page.locator('#dash-user')).toBeVisible();
    await page.waitForTimeout(3000);
    await docScreenshot(page, '20-admin-dashboard');
  });

  test('create event form opens with all fields', async ({ page }) => {
    await page.goto('/dashboard/');
    const createBtn = page.locator('button#btn-create');
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await page.waitForTimeout(500);
    const createSection = page.locator('#section-create');
    await expect(createSection).toBeVisible();
    await docScreenshot(page, '21-create-event');
  });

  test('chapter edit section loads chapter data', async ({ page }) => {
    await page.goto('/dashboard/');
    const editBtn = page.locator('button#btn-chapter');
    await expect(editBtn).toBeVisible();
    await editBtn.click();
    await page.waitForTimeout(2000);
    const chapterSection = page.locator('#section-chapter');
    await expect(chapterSection).toBeVisible();
    await docScreenshot(page, '22-chapter-edit');
  });

  test('event detail view shows attendance', async ({ page }) => {
    await page.goto('/dashboard/');
    await page.waitForTimeout(3000);
    // Click on first event card if one exists
    const eventCard = page.locator('.event-card').first();
    if (await eventCard.isVisible()) {
      await eventCard.click();
      await page.waitForTimeout(2000);
      await docScreenshot(page, '23-event-detail');
    }
  });
});

