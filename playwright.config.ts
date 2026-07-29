/**
 * playwright.config.ts — darkTunes E2E & Visual Regression Test Configuration
 *
 * Runs against a locally built Next.js production server (npm run build &&
 * npm run start) for production-parity results.
 *
 * Projects:
 *  - Desktop Chrome  (1920 × 1080) — PR default in QA workflow
 *  - Mobile Safari   (iPhone 13 — 390 × 844) — main / full matrix
 *  - Mobile Chrome   (Pixel 5   — 393 × 851) — main / full matrix
 *  - Performance Chrome — `npm run perf:test` / performance-tests workflow
 *
 * CI selects projects via `npx playwright test --project=...` (see qa.yml).
 * Workers: CI defaults to 2 (override with PLAYWRIGHT_WORKERS).
 */

import { defineConfig, devices } from '@playwright/test'

const ciWorkers = Number(process.env.PLAYWRIGHT_WORKERS || '2')

export default defineConfig({
  testDir: './tests',

  /* Maximum time a single test may run. */
  timeout: 30_000,

  /* Maximum time for the full test suite. */
  globalTimeout: 10 * 60_000,

  /* Fail the build on CI if a test.only() accidentally gets committed. */
  forbidOnly: !!process.env.CI,

  /* CI runners have no committed snapshot baselines (per AGENTS.md); seed on first run. */
  updateSnapshots: process.env.CI ? 'missing' : 'none',

  /* Retry once on CI to reduce flakiness caused by resource contention. */
  retries: process.env.CI ? 1 : 0,

  /* CI: 2 workers by default (GHA free runners are dual-core); override via PLAYWRIGHT_WORKERS. */
  workers: process.env.CI ? (Number.isFinite(ciWorkers) && ciWorkers > 0 ? ciWorkers : 2) : undefined,

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
      SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key-for-ci',
      CLOUDFLARE_R2_ACCOUNT_ID: process.env.CLOUDFLARE_R2_ACCOUNT_ID || 'placeholder-r2-account',
      CLOUDFLARE_R2_ACCESS_KEY_ID:
        process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || 'placeholder-r2-access-key',
      CLOUDFLARE_R2_SECRET_ACCESS_KEY:
        process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || 'placeholder-r2-secret-key',
      CLOUDFLARE_R2_BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'placeholder-bucket',
      CLOUDFLARE_R2_PUBLIC_URL:
        process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://cdn.placeholder.example',
    },
  },
})
