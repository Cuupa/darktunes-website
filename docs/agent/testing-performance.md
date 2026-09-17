# Testing & Performance

## Unit tests (Vitest)

- `npm test` / `npm run test:watch`
- Setup: `src/test/setup.ts`
- Co-located: `src/**/*.{test,spec}.{ts,tsx}`
- Mock external APIs; no network in unit tests
- Supabase mock: chain methods return `this`; builder is thenable via bound `Promise.resolve`

## E2E (Playwright) — forbidden

Playwright / E2E is **disabled**: do not add, update, run, or require specs under `tests/e2e/` (`npm run test:e2e`, `npm run db:e2e:*`). The removed `qa.yml` / `e2e-comment.yml` workflows must not be re-enabled. Coverage comes from Vitest unit/route tests (`npm run test`) and `npm run ci`; user-flow evidence goes into `QA_CHECKLIST.md`.

### GitHub Actions CI layout (speed)

| Workflow | PR | main / other | Notes |
|----------|----|--------------|--------|
| `ci.yml` | always | always | Parallel jobs: lint+contracts+tsc · unit · build. Concurrency cancel-in-progress. Next + ESLint caches. |
| `security.yml` | only lockfile/package changes | same + weekly schedule | Sole npm audit owner |
| `lighthouse-ci.yml` | **manual dispatch only** | **manual dispatch only** | Run on request via `workflow_dispatch`; no automatic PR/push runs |
| `performance-budget.yml` | **manual dispatch only** | **manual dispatch only** | Run on request via `workflow_dispatch`; no automatic PR/push runs |
| `performance-tests.yml` | **manual dispatch only** | **manual dispatch only** | Run on request via `workflow_dispatch`; no schedule/push runs |

## Performance

- `npm run perf:test` — `tests/performance/`
- **Lighthouse / performance CI runs only on explicit request:** `lighthouse-ci.yml`, `performance-budget.yml` and `performance-tests.yml` are `workflow_dispatch`-only — they must not run automatically on PRs, pushes or a schedule.
- Use `budget(production, ci)` for timing assertions (CI needs higher thresholds)
- LCP: `waitForLoadState('networkidle')` before reading PerformanceObserver
- Bundle budget: `scripts/check-bundle-budget.js` — route keys from `app-build-manifest.json` (hash chunk names, not dependency names)
- Lighthouse: `lhci collect` + `lhci assert` separately (not `autorun`)
- Scripts: `npm run analyze`, `perf:lighthouse`, `perf:build`

**SOS import/export budgets and reference workloads:** [sos-accounting-contract.md](sos-accounting-contract.md) §F (operation IDs, phases, runtime/memory targets, cancellation, background-job threshold, table virtualization). Measurements are part of the #626 release gate.

## Cleanup coverage targets (2026-06 baseline)

Baseline after Phase 0 foundation (main @ 14da8b1):

| Metric | Count |
|--------|------:|
| Vitest files (`**/*.{test,spec}.{ts,tsx}`) | 307 |
| Vitest tests | 1812 |
| Playwright E2E specs (`tests/e2e/`) | 12 |
| `eslint-disable` in production TS | 5 files (6 suppressions reduced from 14 — remaining are `@next/next/no-img-element` for DOM APIs needing naturalWidth/naturalHeight or canvas crop, and `@typescript-eslint/no-require-imports` removed via async dynamic import) |
| `as unknown as` in production DAL | 0 (Phase 2) |

### Module matrix (target: co-located test per module >100 lines)

| Module | Status | Next phase |
|--------|--------|------------|
| `src/lib/sos/data-processor/` | **Done** (split + pipeline tests) | Phase 1.2 `export-utils` |
| `src/lib/sos/export/` | **Done** (shared + PDF/Excel/ZIP split) | — |
| `src/lib/api/settlementRegister.ts` | **Done** (register + carry-forward tests) | — |
| `src/components/admin/sos/SettlementCenter*` | **Done** (panel smoke test + `settlementCenterApi`) | — |
| `app/api/admin/settlements/*` | **Done** (register, periods, lock, archive route tests) | — |
| `src/hooks/useSosCSVProcessor.ts` | **Done** (194-line test file) | — |
| `src/lib/api/epkDocument.ts` | **Done** (`toSupabaseJson`) | — |
| `src/lib/types/jsonColumns.ts` | **Done** (adopted in DAL Phase 2) | — |
| `src/lib/api/settlementCenterApi.ts` | **Done** (fetch helper tests) | — |
| `src/lib/i18n/accountingFallbacks.ts` | **Done** (Phase 0) | — |
| `src/components/admin/forms/ArtistForm.tsx` | **Done** (admin/artist tabs, slug, save smoke tests) | — |
| `app/portal/profile/_components/EPKPreview.tsx` | No tests | Phase 4.1 |
| `src/components/epk-builder/` | Partial (EpkCanvas, EpkCanvasElementNode, EpkFontLoader, EpkGroupNode, EpkPageBackgroundPanel, EpkTemplatePicker, EpkGoogleFontPicker, EpkImageCropDialog, EpkAssetPicker, EpkPagesPanel, EpkToolbar) | Phase 7 (EpkTextEditor, EpkPropertyPanel, EpkSidebar) |
| `src/hooks/` (30 files) | **All 30 have tests** ✅ | — |

Re-run `npm test 2>&1 | grep "Tests "` after each phase to update the Vitest count.