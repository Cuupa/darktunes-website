# Testing & Performance

## Unit Testing

Unit Testing & Quality Assurance
Unit Testing: Write unit tests for all new utilities, API routes, and complex hooks using Vitest.
Test runner: `npm test` (runs `vitest run --config vitest.config.ts`), watch mode: `npm run test:watch`.
Test setup file: src/test/setup.ts – imports @testing-library/jest-dom matchers.
Test files live alongside their source files: src/**/*.{test,spec}.{ts,tsx}.
Test Isolation: Tests must not rely on external network requests. Mock all external APIs (including iTunes, Bandsintown, Odesli, Spotify, and Discogs).
Supabase Mock Pattern: In DAL tests, create a mock builder where all chain methods (select, order, insert, update, delete, upsert, eq, single) return `this` via `vi.fn().mockReturnThis()`. The builder object has `then`, `catch`, `finally` bound to a `Promise.resolve({data, error})`. This makes the entire chain thenable — `await db.from('x').select().order()` resolves correctly.

## E2E & Visual Regression

E2E & Visual Regression Testing (Playwright)
E2E test runner: `npm run test:e2e` (runs `playwright test` using `playwright.config.ts`).
Test files live in `tests/e2e/` — one spec file per concern:
  - `visual.spec.ts`      — full-page & section screenshots for visual regression.
  - `responsive.spec.ts`  — shrinking header, hamburger menu, grid stacking.
  - `interactions.spec.ts`— touch-target sizes (≥ 44×44 px on mobile), video/artist modals, swipe-to-close.
  - `edgecases.spec.ts`   — skeleton ↔ card dimension parity (CLS), long-name truncation, slow-network.
Three browser projects: `Desktop Chrome` (1920×1080), `Mobile Safari` (iPhone 13), `Mobile Chrome` (Pixel 5).
CRT/noise/scanline overlays MUST be hidden via CSS injection (`page.addStyleTag`) before any `toHaveScreenshot` call to prevent flaky diffs from animated noise.
The webServer block in `playwright.config.ts` runs `npm run build && npm run preview` automatically; set `SKIP_BUILD=1` to reuse an existing build artifact.
Tests that require Supabase data gracefully skip via `test.skip(true, reason)` when the relevant DOM section is absent (i.e. Supabase is unconfigured).
Never commit `.playwright-snapshots/` baselines — they are regenerated with `playwright test --update-snapshots` on each environment.

## Performance Monitoring

Performance Monitoring & Budget Enforcement
Performance tests live in `tests/performance/` and are run by the `Performance Chrome` project in `playwright.config.ts`. Run with `npm run perf:test`.
CI-aware timing budgets: GitHub Actions shared runners are significantly slower than production hardware. All timing-based Playwright assertions MUST use the `budget(production, ci)` helper pattern so that CI uses a generous threshold (default 15 000 ms) while the production target is documented inline. NEVER hardcode a single timing constant for both CI and local runs.
LCP measurement: Always call `page.waitForLoadState('networkidle')` before reading LCP from `PerformanceObserver` with `buffered: true`. Using only `requestAnimationFrame` is insufficient — the LCP entry may not be buffered yet.
Bundle size assertions: Measure `rootMainFiles` from `.next/build-manifest.json` as uncompressed bytes on disk. The `next build` output shows gzipped sizes (~3× smaller). The current shared bundle budget is 450 KB uncompressed (≈ 104 KB gzipped).
Lighthouse CI: Use `node_modules/.bin/lhci collect` followed by `node_modules/.bin/lhci assert` as separate workflow steps. Do NOT use `lhci autorun` — it attempts static-site auto-detection and fails on Next.js server-rendered projects. Config lives in `lighthouserc.js` (ESM, `export default`). Remove or omit the `upload` section unless an LHCI server is configured.
Bundle budget script (`scripts/check-bundle-budget.js`): Measures route-specific JS (excluding shared rootMainFiles) from `app-build-manifest.json`. Route keys use the URL segment path format (e.g. `/page`, `/artists/[slug]/page`). Chunk-name-based size checks (e.g. searching for "framer-motion" in filenames) will ALWAYS return 0 KB because Next.js uses hash-based chunk names — do NOT add such checks. Budget thresholds reflect uncompressed on-disk sizes; update them (with a comment) whenever a deliberate new dependency is added.
Performance scripts summary:
  - `npm run analyze` / `npm run perf:analyze` — bundle analyzer (ANALYZE=true next build)
  - `npm run perf:lighthouse` — run `lhci collect && lhci assert` locally (requires prior build)
  - `npm run perf:test` — Playwright performance suite
  - `npm run perf:build` — profiling build (`next build --profile`)

