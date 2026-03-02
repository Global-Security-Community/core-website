const { expect } = require('@playwright/test');

/**
 * Log in via SWA CLI mock auth.
 * @param {import('@playwright/test').Page} page
 * @param {object} opts
 * @param {string} opts.username - e.g. 'test@example.com'
 * @param {string} opts.roles - comma-separated, e.g. 'authenticated,admin'
 */
async function mockLogin(page, { username = 'test@example.com', roles = ['authenticated', 'admin'] } = {}) {
  const roleList = Array.isArray(roles) ? roles : roles.split(',');
  // SWA CLI reads auth from a base64-encoded JSON cookie.
  // Set it directly — avoids jQuery event-binding issues with Playwright.
  const authData = JSON.stringify({
    identityProvider: 'ciam',
    userId: 'playwright-test-user',
    userDetails: username,
    userRoles: [...new Set([...roleList, 'anonymous', 'authenticated'])],
    claims: []
  });
  const cookieValue = Buffer.from(authData).toString('base64');

  await page.context().addCookies([{
    name: 'StaticWebAppsAuthCookie',
    value: cookieValue,
    domain: 'localhost',
    path: '/'
  }]);
  await page.goto('/');
}

/**
 * Take a named screenshot for documentation.
 * Saved to e2e/screenshots/<name>.png
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
async function docScreenshot(page, name) {
  await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });
}

module.exports = { mockLogin, docScreenshot };
