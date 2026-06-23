/**
 * playwright.config.ts — darkTunes E2E & Visual Regression Test Configuration
 *
 * Runs against a locally built Next.js production server (npm run build &&
 * npm run start) for production-parity results.
 *
 * Three browser projects cover all critical viewport combinations:
 *  - Desktop Chrome  (1920 × 1080)
 *  - Mobile Safari   (iPhone 13 — 390 × 844)
 *  - Mobile Chrome   (Pixel 5   — 393 × 851)
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',

  /* Maximum time a single test may run. */
  timeout: 30_000,

  /* Maximum time for the full test suite. */
  globalTimeout: 10 * 60_000,

  /* Fail the build on CI if a test.only() accidentally gets committed. */
  forbidOnly: !!process.env.CI,

  /* Retry once on CI to reduce flakiness caused by resource contention. */
  retries: process.env.CI ? 1 : 0,

  /* Parallelism: 1 worker in CI to keep resource usage predictable. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter: 'list' for concise terminal output; HTML report always generated. */
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    /* Base URL used by page.goto('/') etc. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',

    /* Capture traces only on first retry to aid debugging. */
    trace: 'on-first-retry',

    /* Collect screenshots on failure. */
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'Desktop Chrome',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'Mobile Safari',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: {
        ...devices['iPhone 13'],
      },
    },
    {
      name: 'Mobile Chrome',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: {
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'Performance Chrome',
      testMatch: /performance\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  /* Automatically start the Next.js production server before the test run.
   * The server is stopped automatically after all tests complete.
   *
   * CI hint: set SKIP_BUILD=1 if the build artifact already exists (e.g. from
   * a previous job step) to avoid rebuilding on every run. */
  webServer: {
    command:
      process.env.SKIP_BUILD === '1'
        ? 'npm run preview'
        : 'npm run build && npm run preview',
    url: 'http://localhost:3000',
    /* Allow up to 5 minutes for the build + server start. */
    timeout: 5 * 60_000,
    /* Reuse an already-running server in local development. */
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      /* Ensure the server binds to the expected port. */
      PORT: '3000',
      /* Placeholders so `next build` succeeds when CI secrets are unset (empty string). */
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key-for-ci-build',
    },
  },
})
