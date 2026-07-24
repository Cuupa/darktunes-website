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
import { config as loadEnv } from 'dotenv'

/* Local Supabase stack credentials, written by `npm run db:e2e:start`
 * (scripts/e2e-db-setup.mjs). Falls back to placeholders below when absent
 * so `npm run test:e2e` still works for route-level tests that don't need a
 * real backend. Loaded here (not relying on Next's own .env.local handling)
 * so both the webServer's Next process AND the Playwright test runner itself
 * (tests/helpers/*) see the same values. */
loadEnv({ path: '.env.e2e.local', quiet: true })

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

  /* Parallelism: 1 worker in CI to keep resource usage predictable. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter: 'list' for concise terminal output; HTML report always generated. */
  reporter: [['list'], ['html', { open: 'never' }]],

  /* Ensures the local Supabase stack (Docker) is up, healthy, and its fixture
   * auth users exist before any test runs; optionally stops it afterward.
   * See tests/e2e/global-setup.ts for why this can't provision from scratch
   * (webServer below already starts before globalSetup runs). */
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

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
      /* Local-stack defaults (Supabase CLI's well-known local dev demo
       * credentials — public, identical for every project using default
       * supabase/config.toml, safe to hardcode). Used only when
       * .env.e2e.local hasn't been loaded above (e.g. before the first
       * `npm run db:e2e:start`) so a plain `next build` still succeeds and,
       * once tests/e2e/global-setup.ts brings the stack up, actually points
       * at a real backend instead of an unreachable fake domain. */
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
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
