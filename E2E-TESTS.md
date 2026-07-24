# E2E Test Coverage — Tracking

Goal: Playwright E2E coverage for every route/feature area across the public
frontend, `/admin`, `/portal`, and `/press`, running against a **real local
Supabase stack** (Postgres + Auth + Storage via the Supabase CLI's Docker
stack) instead of mocks or a remote/shared project — as close to production
as possible without touching production data.

This file is the single source of truth for what's actually been built.
Update the checkboxes as work lands; don't let this drift from reality.

## Architecture decision

- Local DB: Supabase CLI local stack (`supabase start`, `supabase/config.toml`,
  ports 54321–54324). Real Postgres/GoTrue/Storage in Docker.
- Schema: `supabase/reset.sql` is the canonical source (no
  `supabase/migrations/` exists today — production is applied by pasting into
  the Supabase Dashboard SQL editor). A generated baseline migration file lets
  `supabase start` apply the real schema locally without changing the
  production deployment process.
- Auth fixtures: created via `supabase.auth.admin.createUser()` (service-role,
  scripted), not raw SQL — GoTrue password hashing/identities aren't reliably
  seedable via plain inserts.
- Content fixtures: `supabase/seed.sql`, applied automatically by
  `supabase start` / `supabase db reset`.
- Test isolation: `workers: 1` for DB-backed runs; tests that create data use
  `e2e-<testId>`-prefixed identifiers and clean up in `afterEach`/`afterAll`.

## Status legend

- [ ] not started
- [~] in progress
- [x] done

## Phase 1 — Local DB foundation

- [ ] `scripts/generate-e2e-migration.mjs` — generates a timestamped migration from `reset.sql`
- [ ] `supabase/migrations/00000000000000_baseline.sql` — generated baseline schema
- [ ] `supabase/seed.sql` — public/admin/portal fixture rows (site_settings, artists, releases, news, events, videos, press accreditations, feature flags, role_permissions)
- [ ] `scripts/e2e-seed-auth.ts` — bootstraps admin/artist/journalist fixture accounts via admin API
- [ ] npm scripts: `db:e2e:start`, `db:e2e:stop`, `db:e2e:reset`

## Phase 2 — Playwright wiring

- [ ] `tests/e2e/global-setup.ts` — ensures local stack is up, runs seed-auth, waits for health
- [ ] `tests/e2e/global-teardown.ts` — optional `supabase stop`
- [ ] `playwright.config.ts` — wire `globalSetup`/`globalTeardown`; local-stack env defaults instead of placeholders
- [ ] `tests/helpers/auth.ts`, `tests/helpers/supabase.ts` — drop remote-only skip guards now that a DB is always available
- [ ] `.env.example` / `.env.e2e.example` — document local-stack E2E vars

## Phase 3 — CI integration

- [ ] `.github/workflows/qa.yml` `e2e-tests` job — add Supabase CLI setup + `supabase start`, stop relying on repo secrets for E2E

## Phase 4 — Test isolation conventions

- [ ] Document prefixed-fixture + cleanup convention once in `tests/helpers/`
- [ ] Confirm `workers: 1` stays enforced for DB-backed local/CI runs

## Phase 5 — Coverage: Public frontend

- [x] `tests/e2e/dynamic-routes.spec.ts` (existing)
- [x] `tests/e2e/route-completeness.spec.ts` (existing)
- [x] `tests/e2e/sitemap-validation.spec.ts` (existing)
- [x] `tests/e2e/user-journeys.spec.ts` (existing)
- [x] `tests/e2e/interactions.spec.ts` (existing)
- [x] `tests/e2e/edgecases.spec.ts` (existing)
- [x] `tests/e2e/responsive.spec.ts` (existing)
- [ ] Contact form submission (real DB insert)
- [ ] Newsletter signup + confirm flow
- [ ] Promo-pool flow
- [ ] Locale fallback behavior (non-en/de Accept-Language)
- [ ] Artist/release/news detail pages against seeded slugs

## Phase 6 — Coverage: `/admin`

- [x] `tests/e2e/admin-scroll.spec.ts` (existing — scroll contract only, not feature coverage)
- [ ] accounting
- [ ] artists
- [ ] assets
- [ ] colors
- [ ] content
- [ ] events
- [ ] features
- [ ] messages
- [ ] news
- [ ] press
- [ ] promo-log
- [ ] release-submissions
- [ ] releases
- [ ] settings
- [ ] statements
- [ ] system
- [ ] users
- [ ] analytics
- [ ] api-keys
- [ ] support
- [ ] tour-planner
- [ ] fan-page-reviews
- [ ] submission-form
- [ ] genres
- [ ] portal-faq
- [ ] RBAC checks against `role_permissions` per section

## Phase 7 — Coverage: `/portal`

- [x] `tests/e2e/portal.spec.ts` (existing — login/redirect smoke only)
- [x] `tests/e2e/tour-planner.spec.ts` (existing)
- [ ] analytics
- [ ] billing
- [ ] calendar
- [ ] documents
- [ ] events
- [ ] help
- [ ] interviews
- [ ] invoices
- [ ] marketing
- [ ] messages
- [ ] profile
- [ ] releases
- [ ] settings
- [ ] statements
- [ ] tour
- [ ] epk-builder
- [ ] fan-page

## Phase 8 — Coverage: `/press`

- [x] `tests/e2e/press-kit.spec.ts` (existing)
- [ ] Journalist application submission → admin accreditation review round trip
- [ ] `/press/dashboard`
- [ ] `/press/releases`
- [ ] `/press/artists`

## Other existing E2E-adjacent specs (unaffected by this plan)

- `tests/e2e/security.spec.ts`
- `tests/e2e/visual.spec.ts` / `tests/e2e/visual-ci.spec.ts`
- `tests/e2e/rls-validation.spec.ts` — currently skips without remote service-role creds; revisit once local stack is wired (Phase 2) since it can then run against the local stack too
- `tests/e2e/feature-completeness.spec.ts`
- `tests/performance/*`
