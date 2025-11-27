import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E testing with coverage
 * Uses global setup/teardown to manage coverage collection
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* No retries for coverage runs */
  retries: 0,

  /* Use fewer workers to ensure coverage is collected properly */
  workers: process.env.CI ? 1 : 4,

  /* Reporter */
  reporter: 'list',

  /* Shorter timeout for faster failure detection */
  timeout: 15_000,

  /* Stop immediately on first failure */
  maxFailures: 1,

  /* Global setup/teardown for coverage */
  globalSetup: './tests/e2e/coverage/global-setup.ts',
  globalTeardown: './tests/e2e/coverage/global-teardown.ts',

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: 'http://localhost:3000',

    /* Disable trace for faster execution */
    trace: 'off',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Disable video recording for speed */
    video: 'off',

    /* Faster action timeout */
    actionTimeout: 10_000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev:coverage',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      VITE_COVERAGE: 'true',
    },
  },
});
