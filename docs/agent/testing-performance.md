# Testing & Performance

## Unit tests (Vitest)

- `npm test` / `npm run test:watch`
- Setup: `src/test/setup.ts`
- Co-located: `src/**/*.{test,spec}.{ts,tsx}`
- Mock external APIs; no network in unit tests
- Supabase mock: chain methods return `this`; builder is thenable via bound `Promise.resolve`

## E2E (Playwright)

- `npm run test:e2e` — specs in `tests/e2e/`
- Projects: Desktop Chrome, Mobile Safari, Mobile Chrome
- Hide CRT/noise overlays before screenshots (`page.addStyleTag`)
- `SKIP_BUILD=1` to reuse existing build
- Skip gracefully when Supabase unconfigured

## Performance

- `npm run perf:test` — `tests/performance/`
- Use `budget(production, ci)` for timing assertions (CI needs higher thresholds)
- LCP: `waitForLoadState('networkidle')` before reading PerformanceObserver
- Bundle budget: `scripts/check-bundle-budget.js` — route keys from `app-build-manifest.json` (hash chunk names, not dependency names)
- Lighthouse: `lhci collect` + `lhci assert` separately (not `autorun`)
- Scripts: `npm run analyze`, `perf:lighthouse`, `perf:build`