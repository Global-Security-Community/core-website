// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:4280',
    screenshot: 'on',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  // Don't auto-start server — SWA CLI must be started separately with nvm use 22
});
