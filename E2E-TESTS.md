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

**Status: done and verified at the database level** (schema, RLS, fixture content, fixture users all confirmed via direct `psql` queries — see "Verification" below). Full Playwright browser validation is blocked by an unrelated local port-3000 conflict, see "Known issue" below.

Design changed from the original plan during implementation, for two reasons discovered along the way:

1. **No `supabase/migrations/` directory** — AGENTS.md and `docs/agent/data-and-schema.md` explicitly forbid one (schema SSOT is `supabase/reset.sql` only). So instead of generating a migration file, `scripts/e2e-db-setup.mjs` applies `supabase/reset.sql` directly over a Postgres connection via `psql`.
2. **`supabase/seed.sql` would collide with the Supabase CLI's own auto-seeding** — `supabase start` automatically executes a file literally named `supabase/seed.sql` *before* `reset.sql` has created any app tables, which crashes (`relation "public.artists" does not exist`). Fixture content instead lives in `supabase/e2e-fixtures.sql`, applied manually, in the right order, by our own script.

Additionally: `reset.sql` has a few early statements (the deprecated `press` → `journalist` role migration) that reference tables created later in the same file — harmless when pasted into the Supabase Dashboard SQL editor (which runs statement-by-statement, continuing past individual errors) but fatal if run as one atomic transaction on a truly empty database. `scripts/e2e-db-setup.mjs` applies `reset.sql` via `psql` (not `ON_ERROR_STOP`) **twice** — pass 1 tolerates the early errors, pass 2 converges to a fully-applied, error-free schema. Verified: 0 real errors on pass 2, 107 tables, 261 RLS policies, `get_my_role()` present, `site_settings` seeded.

- [x] `supabase/e2e-fixtures.sql` — content fixtures: 2 artists (1 visible, 1 hidden), 2 releases, 2 news posts (1 public, 1 press-only), fixed `e2e...` UUIDs
- [x] `tests/e2e/fixtures/seed-ids.ts` — same fixed IDs/slugs, importable from Playwright specs
- [x] `scripts/e2e-db-setup.mjs` — orchestrates `supabase start` → apply `reset.sql` ×2 via psql → apply `e2e-fixtures.sql` → bootstrap 3 fixture auth users (admin/artist/journalist) via GoTrue admin API + promote `public.users.role` + link artist to `artist_members` → write `.env.e2e.local`
- [x] npm scripts: `db:e2e:start`, `db:e2e:stop`, `db:e2e:reset`
- [x] devDependencies added: `pg`, `@types/pg`, `dotenv`, `ws`, `@types/ws` (the last two work around Node 20 lacking native WebSocket, which `@supabase/supabase-js`'s realtime client requires even though we only use the admin REST API)
- [x] `.env.e2e.example` — documents the generated `.env.e2e.local` shape
- [x] `playwright.config.ts` — loads `.env.e2e.local` via `dotenv` so both the Playwright runner and the Next.js `webServer` see local-stack credentials (pulled forward from Phase 2 to allow end-to-end validation)

### Verification (2026-07-24)
```
psql: 107 tables in public schema, 261 RLS policies, get_my_role() present
public.users roles: e2e-admin@darktunes.test=admin, e2e-artist@darktunes.test=artist, e2e-journalist@darktunes.test=journalist
public.artist_members: e2e-artist fixture linked to e2e-visible-artist as owner
public.artists: e2e-visible-artist (is_visible=t), e2e-hidden-artist (is_visible=f)
npm run db:e2e:start re-run: fully idempotent (no errors, "already exists" for fixture users)
```

### Known issue — not caused by this work (resolved for this session)
Local Playwright runs default to `http://localhost:3000`, which was being reclaimed by an unrelated project (`/home/simon/Projects/FinTrack`) on this machine. User stopped it manually. Worth remembering if it recurs: `reuseExistingServer: !process.env.CI` will silently reuse whatever's already on port 3000 rather than building darktunes, which produces very confusing failures (unrelated 404s, a form that looks permanently disabled).

### Live Playwright run against the local stack (2026-07-24)
Ran `tests/e2e/portal.spec.ts` against the real local Supabase stack end-to-end:
- ✅ `unauthenticated users are redirected to /login`
- ✅ `upload-asset API rejects unauthenticated requests` (401)
- ❌ `authenticated portal overview renders when credentials are configured` — form fills correctly with the `e2e-artist` fixture credentials, "Sign In" is clicked, but the page never navigates to `/portal` within 15s and no visible error appears. Not yet root-caused; candidates to check first: the recently-added portal login rate limiter (`f7795f1e fix(portal): harden P0 rate limit...`) possibly triggered by repeated test runs against the same fixture account, or a client-side auth error that isn't surfaced in the UI. Flagged for Phase 7 (`/portal` coverage) rather than chased down here, since Phase 1's job — proving the local DB foundation itself works — is done: 2/3 tests already exercise real backend behavior (redirect + real 401 from a real route) correctly.

## Phase 2 — Playwright wiring

**Status: done.**

- [x] `tests/e2e/global-setup.ts` — ensures local stack is up, runs seed-auth, waits for health
  - Can't do first-time provisioning (webServer in `playwright.config.ts` starts *before* `globalSetup` runs — verified against the installed Playwright's task ordering). So `.env.e2e.local` from `npm run db:e2e:start` must already exist; global-setup's job is: verify required env vars, verify/`supabase start` the stack, poll GoTrue's `/auth/v1/health`, then re-run the (now-shared) fixture-user upsert so a `supabase db reset` or fresh container can't silently drop the fixture accounts.
  - Extracted the fixture-user/status logic shared with `scripts/e2e-db-setup.mjs` into `scripts/e2e-db-lib.mjs` so the two entry points can't drift.
- [x] `tests/e2e/global-teardown.ts` — optional `supabase stop`, gated behind `E2E_STOP_DB_AFTER_TESTS=1` (default off, so local iteration doesn't pay full Docker startup cost every run; CI can opt in)
- [x] `playwright.config.ts` — wired `globalSetup`/`globalTeardown`; `webServer.env` fallbacks changed from fake `placeholder.supabase.co` values to the Supabase CLI's well-known local-dev demo URL/keys (public, identical for every project on default `config.toml`), so an unconfigured build still points at a real local backend once the stack is up
- [x] `tests/helpers/auth.ts`, `tests/helpers/supabase.ts` — dropped remote-only skip guards (`isSupabaseE2EConfigured`, `getTestUser` returning `null`) now that a DB is always available; both now throw an actionable error instead. Updated all specs that used those guards: `dynamic-routes`, `interactions`, `feature-completeness`, `press-kit`, `tour-planner`, `admin-scroll`, and `rls-validation` (the last was explicitly flagged in this file for a Phase 2 revisit — done)
- [x] `.env.example` / `.env.e2e.example` — documented local-stack E2E vars and the new global-setup/teardown behavior

## Phase 3 — CI integration

**Status: done, not yet verified against a real GitHub Actions run** (no way to trigger Actions from this environment — verified by reading the job through and validating YAML syntax; flag if the first real CI run surfaces something).

- [x] `.github/workflows/qa.yml` `e2e-tests` job — add Supabase CLI setup + `supabase start`, stop relying on repo secrets for E2E
  - `supabase/setup-cli@v1` installs the real CLI binary onto `PATH`; `npx --yes supabase ...` (used throughout `scripts/e2e-db-setup.mjs`/`e2e-db-lib.mjs`) resolves to it directly instead of hitting the npm registry each run.
  - Added a defensive `command -v psql || apt-get install postgresql-client` step — GitHub's `ubuntu-latest` image normally ships `psql`, but `scripts/e2e-db-setup.mjs` depends on it to apply `reset.sql`, so don't assume.
  - `npm run db:e2e:start` now runs as its own step: starts the Docker stack, applies the schema twice, applies fixtures, bootstraps the 3 fixture auth users, writes `.env.e2e.local`.
  - The old job-level `env:` block (`secrets.NEXT_PUBLIC_SUPABASE_URL != '' && ... || placeholder`) is gone. Cloudflare R2 vars stay as flat placeholders at job level (no E2E test touches real object storage). The three Supabase vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are deliberately **not** set at job level — `playwright.config.ts`'s `dotenv.config({ path: '.env.e2e.local' })` does not override variables already present in `process.env`, so a job-wide placeholder would permanently shadow the real local-stack credentials written above and every DB-backed test would silently talk to a fake domain instead.
  - `npm run build` still needs *some* value for those three vars (`src/lib/env.server.ts`'s Zod schema throws during Next's "Collecting page data" build step if they're missing), so placeholders are supplied **step-scoped** to the build step only, not job-wide.
  - `E2E_STOP_DB_AFTER_TESTS=1` set at job level so `tests/e2e/global-teardown.ts` stops the Docker stack at the end of the CI run (kept off by default for local dev — see Phase 2).

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
- `tests/e2e/rls-validation.spec.ts` — no longer skips; runs against the local stack's service-role creds since Phase 2 (see above)
- `tests/e2e/feature-completeness.spec.ts`
- `tests/performance/*`
