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

## Cleanup coverage targets (2026-06 baseline)

Baseline after Phase 0 foundation (main @ 14da8b1):

| Metric | Count |
|--------|------:|
| Vitest files (`**/*.{test,spec}.{ts,tsx}`) | 167 |
| Vitest tests | 1302 |
| Playwright E2E specs (`tests/e2e/`) | 12 |
| `eslint-disable` in production TS | 14 files |
| `as unknown as` in production DAL | 0 (Phase 2) |

### Module matrix (target: co-located test per module >100 lines)

| Module | Status | Next phase |
|--------|--------|------------|
| `src/lib/sos/data-processor/` | **Done** (split + pipeline tests) | Phase 1.2 `export-utils` |
| `src/lib/sos/export/` | **Done** (shared + PDF/Excel/ZIP split) | — |
| `src/lib/api/settlementRegister.ts` | **Done** (register + carry-forward tests) | — |
| `src/components/admin/sos/SettlementCenter*` | **Done** (panel smoke test + `settlementCenterApi`) | — |
| `app/api/admin/settlements/*` | **Done** (register, periods, lock, archive route tests) | — |
| `src/hooks/useSosCSVProcessor.ts` | No tests | Phase 1.4 |
| `src/lib/api/epkDocument.ts` | **Done** (`toSupabaseJson`) | — |
| `src/lib/types/jsonColumns.ts` | **Done** (adopted in DAL Phase 2) | — |
| `src/lib/api/settlementCenterApi.ts` | **Done** (fetch helper tests) | — |
| `src/lib/i18n/accountingFallbacks.ts` | **Done** (Phase 0) | — |
| `src/components/admin/forms/ArtistForm.tsx` | **Done** (admin/artist tabs, slug, save smoke tests) | — |
| `app/portal/profile/_components/EPKPreview.tsx` | No tests | Phase 4.1 |
| `src/components/epk-builder/` | No component tests | Phase 7 |
| `src/hooks/` (21 files) | 2 tests | Phase 6.1 |

Re-run `npm test 2>&1 | Select-String "Tests "` after each phase to update the Vitest count.