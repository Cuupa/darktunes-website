Developer & Agent Guidelines (AGENTS.md)
MANDATORY: All developers and AI agents working on this project MUST strictly adhere to the following guidelines. This ensures code quality, security, legal compliance (GDPR), perfect UI/UX, and maintainability.

Clean Code & Architecture (ISO/IEC 25010)
Single Responsibility Principle (SRP): No "God Objects". Files like App.tsx must not contain thousands of lines of code. Split functionality into small, focused, and reusable components.
Separation of Concerns: Keep UI components (React), state management (Hooks/Context), and business logic (API calls/Lib functions) separate.
Code Splitting & Lazy Loading: Use React.lazy() and Suspense for heavy components (e.g., 3D models, admin panels, complex galleries) to keep the initial JavaScript bundle small and performant.
Strict Typing: Avoid the use of any in TypeScript. All variables, function parameters, API responses, and test mocks MUST be strictly typed.
Dry Principle: Do not repeat code. Use reusable hooks and utility functions.

Test Driven Development (TDD): Define conditions through tests before implementing complex logic.
Avoid Anti-Patterns: Absolutely avoid anti-patterns like prop-drilling over more than two levels and massive monolithic files.
YAGNI (You Aren't Gonna Need It): Do not generate speculative code for hypothetical features. Keep the codebase lean.
KISS (Keep It Simple, Stupid): Prefer native HTML/JS solutions over the importation of heavy NPM packages.

Technology Stack & Styling
Core Infrastructure: Next.js 15 (App Router), React 19, Supabase (PostgreSQL & Auth), Cloudflare R2, Vercel deployment. The project was migrated from Vite SPA to Next.js 15 App Router in 2025.
UI & Design: Exclusively use Tailwind CSS v4 (PostCSS) and ensure the CSS output is minified.
Motion & UX: Implement fluid page transitions and shared layout animations with Framer Motion, and utilize Lenis for smooth scrolling. Use Phosphor Icons for all vector graphics.

CI Color System (darkTunes Brand)
The following exact hex values MUST be used. They are mapped to CSS custom properties in src/index.css and must not be replaced with approximations:
  --primary / --accent / --ring: #493687  (violet – primary CTAs, active nav, focus rings)
  --secondary:                   #7e1e37  (pink – secondary buttons, hover effects, promo badges)
  --background:                  #101010  (near-black – global page background, immersive dark mode)
  --card / --muted / --popover:  #292929  (surface – cards, modals, dropdowns, player bar)
  --border / --input:            #383838  (subtle borders, input frames, disabled states)
  --foreground / text:           #ffffff  (primary text – maximum contrast on dark surfaces)

Smooth Scrolling (Lenis)
The LenisProvider (src/components/animations/LenisProvider.tsx) is the single global smooth-scroll implementation.
It is mounted once at the root level in app/_components/Providers.tsx and wraps the entire React tree.
Do NOT add a second LenisProvider instance anywhere else in the tree.
Do NOT use CSS scroll-behavior: smooth as a replacement – Lenis overrides this at the JS layer.
LenisProvider uses ReactLenis from lenis/react (root mode) so any component can call useLenis() to get the Lenis instance for programmatic scrolling.
useLenis is re-exported from src/components/animations/LenisProvider.tsx. Import from there (not directly from lenis/react) for consistency.
For anchor-based scrolling in Header/Footer, use: const lenis = useLenis(); lenis?.scrollTo(href, { offset: -140 })

WCAG 2.1 AA/AAA Accessibility
All public-facing pages MUST comply with WCAG 2.1 AA at minimum; strive for AAA where feasible.
Skip Navigation: app/layout.tsx includes a sr-only skip link (<a href="#main-content">) as the first focusable element. The <main> element in HomePageContent.tsx carries id="main-content".
Semantic HTML: Content grids (Artists, News, Videos, Releases) use <ul>/<li> with list-none to allow grid styling while preserving list semantics for screen readers.
Reduced Motion (WCAG 2.3.3 – AAA): Import useReducedMotion from framer-motion in every animated component. When prefersReducedMotion is true, set duration: 0 and skip initial offset transforms.
ARIA on dialogs: All Dialog components must set aria-labelledby pointing to the modal title's id. Close buttons must have a descriptive aria-label (e.g. "Close ${artist.name}"). Icons inside interactive elements must carry aria-hidden="true".
Icon-only links: Any link that renders only an icon MUST have a descriptive aria-label (e.g. aria-label="`${artist.name} on Spotify`").
Touch Targets (WCAG 2.5.5 – AAA): Icon-only interactive elements must include min-w-[44px] min-h-[44px] on the anchor/button element.
Navigation ARIA: Desktop <nav> must have aria-label="Main navigation". Mobile toggle button must have aria-expanded and aria-controls="mobile-menu". Mobile <nav> must have id="mobile-menu" and aria-label="Mobile navigation".
Alt text: Images must have descriptive alt text, e.g. "${artist.name} – artist photo", "${release.title} by ${artistName} – cover art", "${video.title} – video thumbnail".
Decorative elements (e.g. animated scroll-down indicator) must carry aria-hidden="true".

Unit Testing & Quality Assurance
Unit Testing: Write unit tests for all new utilities, API routes, and complex hooks using Vitest.
Test runner: `npm test` (runs `vitest run --config vitest.config.ts`), watch mode: `npm run test:watch`.
Test setup file: src/test/setup.ts – imports @testing-library/jest-dom matchers.
Test files live alongside their source files: src/**/*.{test,spec}.{ts,tsx}.
Test Isolation: Tests must not rely on external network requests. Mock all external APIs (including iTunes, Bandsintown, Odesli, Spotify, and Discogs).
Supabase Mock Pattern: In DAL tests, create a mock builder where all chain methods (select, order, insert, update, delete, upsert, eq, single) return `this` via `vi.fn().mockReturnThis()`. The builder object has `then`, `catch`, `finally` bound to a `Promise.resolve({data, error})`. This makes the entire chain thenable — `await db.from('x').select().order()` resolves correctly.

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

Data Access Layer (DAL)
All database queries live in `src/lib/api/` — one file per table (artists.ts, releases.ts, news.ts, videos.ts, assets.ts, siteSettings.ts, artistProfiles.ts, streamingStats.ts, salesStatements.ts, newsletter.ts, pressPhotos.ts, promoTracks.ts, journalistApplications.ts).
Every DAL function receives `SupabaseClient<Database>` as its first argument. Never import the global `supabase` singleton inside a DAL file.
DAL functions throw `new Error(error.message)` when Supabase returns an error. For `.single()` queries, error code `PGRST116` (not found) returns `null` instead of throwing.
Row-to-domain mappers: Use `rowTo*` functions to convert snake_case DB rows to camelCase domain types. Nullables map to `undefined` (optional fields) or `''` (required string fields) using `?? undefined` / `?? ''`.
Shared mappers: `src/lib/api/artistRowMapper.ts` exports `rowToArtist()` — used by both `artists.ts` and `artistProfiles.ts` to avoid duplication.
Site Settings DAL: `siteSettings.ts` uses `rowsToSettings()` (flat key-value rows → typed `SiteSettings` domain object) with hardcoded defaults as fallback. Use `upsertSiteSettings(db, record)` for batch saves from the Admin CMS. The `feature_toggles` key stores a JSON object (`FeatureToggles`) for global feature flags.
Hook Pattern: Hooks in `src/hooks/` wrap DAL functions. Each hook checks `isSupabaseConfigured` at load time — if false, immediately sets `isLoading = false` and returns empty data. This prevents Supabase calls when env vars are not set.
Next.js Route Handlers: API endpoints live at `app/api/*/route.ts`. The upload handler (`app/api/upload/route.ts`) requires admin or editor role. Never use the legacy `api/` directory for new endpoints.
Server-side Supabase Clients: Use `src/lib/supabase/server.ts` (createServerSupabaseClient) in Server Components and Route Handlers. Use `src/lib/supabase/client.ts` (createBrowserSupabaseClient) in Client Components.
Server Env Validation: Import `src/lib/env.server.ts` in Route Handlers to get Zod-validated server-side environment variables. This module throws at startup if any required server var is missing.
Next.js Caching: In app/page.tsx, data is fetched using `unstable_cache` with explicit `revalidate: 60` and `tags`. This is required because Next.js 15 no longer caches fetch/GET by default.
CRITICAL — unstable_cache and Dynamic APIs: In Next.js 15, dynamic APIs such as `cookies()`, `headers()`, and `params` CANNOT be called inside `unstable_cache` callbacks. Any call to `createServerSupabaseClient()` (which calls `cookies()`) inside an `unstable_cache` callback will throw at runtime, causing `.catch(() => null)` guards to silently return null and trigger `notFound()` → 404. ALWAYS use a cookie-free client inside `unstable_cache`: `createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)`. For public read operations (artists, releases, site settings) the anon key + RLS is sufficient; no session cookie is needed.
Public vs Admin DAL: The public homepage (app/page.tsx) uses `getPublicArtists()`, `getPublicReleases()`, and `getPublicConcerts()` which filter by `is_visible = TRUE` and cascade that filter via artist linkage. Admin hooks use the unrestricted `getArtists()` / `getReleases()` / `getConcerts()` to see all records including hidden ones.

Detail Page Data API Waterfall
app/releases/[id]/page.tsx — Data API Waterfall:
  1. URL segment `id` → UUID of the release
  2. `getReleaseById(client, id)` → SELECT * FROM releases WHERE id = ? (RLS: anon sees visible releases with visible artists)
  3. `getDictionary(locale)` → resolved from NEXT_LOCALE cookie / Accept-Language header
  Steps 2+3 run in parallel via Promise.all. Cookie-free public client used inside unstable_cache (revalidate: 60, tag: 'releases').

app/artists/[slug]/page.tsx — Data API Waterfall:
  1. URL segment `slug` → artist slug
  2. `getArtistBySlug(client, slug)` → SELECT * FROM artists WHERE slug = ? (RLS: anon sees visible artists)
  3. `getReleasesByArtistId` + `getConcertsByArtistId` + `getVideosByArtistId` → three parallel queries using the resolved artist.id
  4. `getDictionary(locale)` → locale resolution
  Steps 2+3+4 run concurrently after step 1 resolves. Cookie-free public client used inside unstable_cache (revalidate: 60, tags: artists/releases/concerts/videos).

Inversion of Control (IoC) & Component Contracts
Props Over State: UI components MUST receive all data and callbacks as props — they must not directly access global state, context, or external stores.
No Direct Context Reads: Components that render UI (sections, cards, widgets) must receive their data via props. Context access is only permitted in top-level wiring components (e.g., App.tsx, AdminPanel.tsx, use-app-state.ts).
Section Contracts: All page sections must extend SectionProps (or EditableSectionProps<T>) from src/lib/component-contracts.ts. The editMode, sectionLabels, and onLabelChange props are mandatory.
Admin Panel Contracts: All admin sub-forms must extend AdminPanelProps<T> from src/lib/component-contracts.ts. No sub-form should import or read AdminSettings directly from storage/context.
Dialog Contracts: All modals must extend DialogProps (with open / onClose). No dialog should manage its own visibility state internally.

Admin Route Auth Pattern
All admin API routes MUST use the shared auth helpers from `src/lib/adminAuth.ts`:
  - `extractBearerToken(authHeader)` — extracts the JWT from `Authorization: Bearer <token>`, throws ApiError(401) if missing.
  - `verifyAdminOrEditor(token)` — verifies the token with the Supabase service-role client and asserts `admin` or `editor` role. Throws ApiError(401) for invalid tokens, ApiError(403) for insufficient role.
Do NOT duplicate `verifyTokenAndRole` inline in individual route files — use the shared helper.
Every admin route MUST be wrapped with `withErrorHandler` from `src/lib/errors.ts` for uniform error responses.

Domain Layer (src/domain/)
Repository Interfaces: `src/domain/repositories/` contains TypeScript interfaces (IArtistRepository, IReleaseRepository, INewsRepository, IAssetRepository) that define what the application needs from persistent storage without depending on Supabase. Concrete implementations live in `src/lib/api/`. This enforces the Dependency Inversion Principle.
Event Bus: `src/domain/events/eventBus.ts` provides a typed pub/sub Event Bus for decoupled domain event communication. Import the singleton `eventBus` for application-wide use or `createEventBus()` for isolated test buses. DomainEvent union includes: artist.synced, release.synced, asset.uploaded, asset.deleted, user.role.changed, sync.completed. Use `eventBus.on(type, handler)` to subscribe and `eventBus.emit(event)` to publish. Async handler errors are caught and logged — they never propagate to the emitter.

Web Workers (src/workers/)
CPU-intensive image operations (resize, format conversion) MUST use `src/workers/imageProcessor.worker.ts` via `createImageProcessorWorker()` from `src/workers/index.ts` so the main thread stays responsive.
Worker instances are lazily created per component/operation and MUST be terminated (`processor.terminate()`) when done. Create in component mount effect, terminate in cleanup.
ImageBitmap objects are transferred (not copied) to the worker via the Transferable API — do not reuse a bitmap after calling `resize()` or `toBlob()`.


Server-side external API calls MUST use `withExponentialBackoff()` from `src/lib/rateLimiter.ts`.
Throw `HttpError(status, message)` for HTTP errors to distinguish retryable (429, 5xx) from non-retryable failures.
Non-HTTP errors (e.g. network errors) are not retried — they fail immediately.

Image Optimisation
All public-facing images MUST be served via `getOptimizedImageUrl(url, width)` or `getSquareThumbnail(url, size)` from `src/lib/imageUtils.ts`.
These functions proxy through wsrv.nl and output WebP format, preventing origin load.
Use `getOptimizedImageUrl` for rectangular/banner images and `getSquareThumbnail` for cover art / profile photos.

Sync Service Pattern
Complex sync logic lives in `src/lib/sync/` with a dependency-injected `SyncDeps` interface (db, fetch, uploadToR2).
The HTTP handler in `app/api/sync-artist/route.ts` only wires deps and calls `syncArtist()`. Tests mock all deps.
Sync functions MUST NOT throw — capture all errors in `SyncResult.errors` and return gracefully.
Every sync run writes a `sync_logs` entry with status 'success', 'partial', or 'error'.
`sync_logs` also records `api_source` (itunes | spotify | discogs | songkick | bandsintown | odesli | all) and `rate_limited` (boolean) per run.
The full multi-API orchestrator lives in `src/lib/sync/syncAll.ts` (SyncAllDeps extends SyncDeps with optional spotify/discogsToken/songkickApiKey/bandsintownAppId). Called by `POST /api/sync`.
Release deduplication: `src/lib/sync/deduplication.ts` merges Spotify + Discogs releases using ISRC → barcode/UPC → normalised title + year precedence.
`syncAllReleases()` in `useReleases.ts` returns the full `SyncAllResult` (typed import from `src/lib/sync/syncAll.ts`). `ReleasesManager` parses the result: on success shows a toast with total items synced; on errors shows a warning toast and a "View Errors" button that opens a dialog with per-API error details.

Admin Utility Routes (admin/editor auth required):
  `POST /api/admin/cleanup-orphaned-releases` — deletes all releases where `artist_id IS NULL` (uses service-role client). Returns `{ deleted: number }`. Triggered by the "Clean Orphaned" button in ReleasesManager.
  `POST /api/admin/fetch-youtube-info` — resolves a YouTube URL or video ID to `{ videoId, title, channelTitle, thumbnailUrl }` via YouTube oEmbed (no API key needed). Called by the "Fetch Info" button in VideoForm.

Video Admin UX:
  VideoForm accepts full YouTube URLs (watch?v=, youtu.be/, /shorts/, /embed/) and auto-extracts the 11-char video ID on input.
  "Fetch Info" button calls `/api/admin/fetch-youtube-info` to auto-fill title, channel name, and thumbnail.
  VideosManager has a "Sync YouTube Channel" button that calls `POST /api/sync-youtube` and shows synced count in toast.

Artist Import (Spotify + Apple Music):
  ArtistForm has a single Spotify URL field (no duplicated quick-import field) with an "Import" button that pre-fills name, image, genres, spotifyId, and spotifyUrl via `POST /api/admin/prefill-artist`.
  ArtistForm also has an Apple Music URL field with an "Import" button that pre-fills name, image, genres, and appleMusicUrl via `POST /api/admin/prefill-artist-itunes`.

Cascade Deletes:
  `releases.artist_id` uses `ON DELETE CASCADE`. When an artist is deleted, all their releases are automatically deleted by the DB.
  The delete confirmation dialog in ArtistsManager explicitly states this to the user.

Discogs Artist Enrichment (manual):
  `src/lib/sync/discogsApi.ts` exports two functions:
    - `fetchDiscogsArtistReleases(id, token, fetch)` — paginated release list (used by syncAll).
    - `fetchDiscogsArtistProfile(id, token, fetch)` — fetches artist bio, primary image, and URLs from `GET /artists/{id}`. Token is optional (higher rate limit when provided).
  `cleanDiscogsMarkup(text)` strips Discogs wiki markup ([a=Name], [l=Label], [url=…][/url], etc.) and is exported for standalone use and testing.
  Admin route `POST /api/admin/enrich-artist-discogs` (body: `{ discogsId }`) verifies admin/editor role, calls `fetchDiscogsArtistProfile`, and returns `{ name, bio, imageUrl, urls }`. It does NOT write to the DB — the admin UI applies the data via the normal artist update flow.
  The "Enrich from Discogs" button in `ArtistForm` only fills empty fields (bio, imageUrl) — it never overwrites data the admin has already entered.

Odesli (song.link) Smart Links:
  `src/lib/sync/odesliApi.ts` exports `resolveOdesliSmartLink(musicUrl, fetch)` which resolves any streaming URL to a universal smart link page.
  During the full `syncAll` run, Odesli is called for every newly synced release to populate `releases.smart_url`.
  Admin route `POST /api/admin/resolve-release-smart-link` (body: `{ releaseId }`) lets editors manually resolve the Odesli link for a single release and persists it to `releases.smart_url`.
  The "Resolve Smart Link" (link icon) button in ReleasesManager triggers this route. The button is disabled when the release has no Spotify or Apple Music URL.
  On the public release detail page (`app/releases/[id]`), a "Listen Everywhere" button links to `release.smartUrl` when populated (shown first, above platform-specific links).

Centralized Error Handling
All Next.js Route Handlers MUST be wrapped with `withErrorHandler` from `src/lib/errors.ts`.
`withErrorHandler` catches `ApiError` (returns its status code), `ZodError` (returns 400 with VALIDATION_ERROR code), and unknown errors (returns 500). All responses follow `{ error, code, status }` shape.
Throw `new ApiError(status, message, code?)` inside route handlers instead of manually returning `NextResponse.json({ error })`.
`app/error.tsx` and `app/global-error.tsx` are the Next.js rendering error boundaries.

R2 Image Caching
When syncing external content, always download cover/artwork images and upload to Cloudflare R2 via `uploadUrlToR2()` from `src/lib/r2Utils.ts`.
Store the R2 public URL (not the external URL) in the database. The public website reads only from Supabase + R2.
If R2 upload fails during sync, fall back to the external URL and log the error — do not abort the sync.

Internationalisation (i18n)
The site supports English (`en`) and German (`de`). German is the default locale.
Dictionary files live in `src/i18n/dictionaries/en.json` and `src/i18n/dictionaries/de.json`.
The shared type `Dictionary` in `src/i18n/types.ts` is structurally derived from the English baseline — add new keys there first.
Locale resolution order: 1) `NEXT_LOCALE` cookie, 2) `Accept-Language` request header, 3) `de` default.
Server-side loading: call `getLocale()` then `getDictionary(locale)` from `src/i18n/getDictionary.ts` inside Server Components. Never call these from Client Components.
Prop injection (IoC): RSC parents fetch the dictionary and pass relevant sub-objects (e.g. `dict.navigation`, `dict.consent`) to Client Components as props. Client Components MUST NOT import or call dictionary functions themselves.
Locale switching: the Header writes `document.cookie = 'NEXT_LOCALE=...'` on the client and calls `router.refresh()` to trigger a server re-render with the new locale.
When adding new user-facing strings: add the English key to `en.json`, add the German translation to `de.json`, update the `getDictionary` return type (auto-inferred), then thread the new key through the RSC → Client Component prop chain.

Agent Workflow Requirements
These rules apply specifically to AI agent runs on this project:
Update AGENTS.md: AGENTS.md is the living specification of this project and serves as a dedicated, predictable place for context. If new conventions, patterns, or architectural decisions were introduced, add or update the relevant section in this file after every run.
Review & Update All Docs and Scripts: At the END of EVERY agent session, review each of the following files for accuracy and update any section that is stale or inconsistent with the actual codebase:
  - README.md (quick start, scripts table, env-var table, project structure)
  - DEPLOYMENT.md (env-var names must match .env.example and scripts/vercel-install.sh exactly)
  - INTEGRATION-SUMMARY.md (reflect the current implemented vs. pending state)
  - ADMIN.md (admin panel features and setup steps)
  - SECURITY.md (security practices relevant to the actual code)
  - scripts/vercel-install.sh (env-var list must match .env.example)
  - .env.example (must list every variable the app actually reads)
This review is MANDATORY, not optional, even when no documentation changes were part of the original task.
Update Documentation: If new public APIs, components, or utilities were added, update the relevant docs in the docs/ directory or inline JSDoc comments.
Minimal Changes Principle: Make the smallest possible change that fully addresses the requirement. Do not refactor unrelated code in the same PR. Do not add new dependencies unless absolutely necessary — check npm audit for any new package.

Database Schema Management
`supabase/reset.sql` and `src/types/database.ts` are the dual source of truth for the database structure. They MUST always be in sync. There are no incremental migration files — only the single idempotent reset script.

MANDATORY RULE — Schema Change Checklist:
Every PR that adds, removes, or renames a column / table / enum MUST include ALL of the following:
  1. Updated `supabase/reset.sql` — add the column/table to the CREATE TABLE definition AND add an idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` guard so existing databases are updated safely.
  2. Updated `src/types/database.ts` to reflect the new schema (Row, Insert, Update shapes).
  3. If applicable: updated application hooks (src/hooks/use*.ts) that query the affected table.

Apply the schema to Supabase cloud: paste `supabase/reset.sql` into the Supabase SQL Editor and run it (fully idempotent — safe on fresh and existing databases).
Visibility & Cascading Deletes: `artists.is_visible` and `releases.is_visible` (both BOOLEAN DEFAULT TRUE) control public visibility. `releases.artist_id` uses `ON DELETE CASCADE` so deleting an artist removes all their releases automatically. RLS policies enforce visibility at the DB level for the public role; the DAL public functions (`getPublicArtists`, `getPublicReleases`, `getPublicConcerts`) enforce it additionally at the application layer.
Video ownership: `videos.artist_id UUID REFERENCES artists(id) ON DELETE SET NULL` links synced label-channel videos to artists. Artist profile pages fetch videos via `getVideosByArtistId()`; when no match exists, `artist_id` remains NULL and the homepage still shows latest videos globally.

Artist Portal (Multi-Tenant)
The Artist Portal lives at `/portal/*` — a secure dashboard for the label's bands.
Auth: `middleware.ts` protects all `/portal/*` routes (except `/portal/login`) using the same Supabase session-cookie pattern as `/admin/*`.
Multi-tenancy: `artists.user_id UUID REFERENCES auth.users(id)` links each artist row to a Supabase Auth user. One auth user ↔ one artist.
Portal DAL functions: `getArtistByUserId(db, userId)` in `src/lib/api/artistProfiles.ts` resolves the current user's linked artist. Always call this before accessing artist-scoped data.
RLS enforcement: `artist_profiles`, `streaming_stats`, `sales_statements`, and `release_checklists` all have RLS policies that use `EXISTS (SELECT 1 FROM artists WHERE id = artist_id AND user_id = auth.uid())`. Security is at the DB layer; no middleware-only filtering.
Presigned URL pattern: `src/lib/portal/presignedUrl.ts` exposes two injectable functions:
  - `generatePresignedDownloadUrl(r2Key, deps)` — 5-minute GET URL for artist downloads (`PresignedUrlDeps`)
  - `generatePresignedUploadUrl(r2Key, contentType, deps)` — 15-minute PUT URL for the SOS PDF generator to upload directly to R2, bypassing Vercel's 4.5 MB body limit (`PresignedUploadUrlDeps`)
  The Server Action `app/portal/statements/_actions/presignedUrl.ts` wires real deps for artist-facing downloads.
Photo upload: `app/api/portal/upload-photo/route.ts` accepts `multipart/form-data`, verifies auth, confirms artist ownership, then uploads to `profile-photos/{artistId}/{uuid}.{ext}` in R2. Max 5 MB, image types only.
IoC in portal: Every portal page is a Server Component that fetches data and passes it as props to a `"use client"` leaf component. Leaf components never call `fetch` or Supabase directly.
Release checklists: `src/lib/api/releaseChecklists.ts` provides `getOrCreateReleaseChecklist(db, artistId, releaseId)` (seeds DEFAULT_RELEASE_TASKS on first call) and `toggleChecklistItem(db, id, isCompleted)`. The PATCH `/api/portal/checklist` route handler uses Bearer token auth and relies on RLS for artist-scoped enforcement.
Bio lengths: `artist_profiles` has three bio columns — `bio_short` (≤100 words), `bio_medium` (≤300 words), `bio_long` (≤1000 words) — in addition to the general `bio` field. The profile form exposes all four.
Portal nav items are now feature-flag aware (`portal_feature_flags`): Overview, Profile, Analytics, Releases (`/portal/releases`), Tour (`/portal/tour`), Marketing (`/portal/marketing`), Statements, Messages (`/portal/messages`).

SOS Webhook (Statement of Sales PDF Upload)
The external SOS PDF generator (https://sos-generator-for-mu.vercel.app/) uses a 2-step presigned URL flow to deliver PDFs to R2 without hitting Vercel's 4.5 MB body limit.
Step 1 — POST /api/webhooks/sos: Validates API key, validates metadata (artistId, filename, period, amountEur?), verifies artist exists via service-role client, generates an R2 key (`statements/{artistId}/{uuid}_{filename}`), returns a 15-minute presigned R2 PUT URL.
Step 2 — POST /api/webhooks/sos/confirm: Validates API key, validates payload (r2Key, artistId, filename, period, amountEur?), inserts a `sales_statements` DB row via service-role client (bypasses RLS), returns `{ statementId }`.
Authentication: Both endpoints check `Authorization: Bearer <SOS_WEBHOOK_SECRET>` against the `SOS_WEBHOOK_SECRET` environment variable. Return 503 if the variable is unset; 401 on mismatch.
DAL: `createSalesStatement(db, data)` in `src/lib/api/salesStatements.ts` inserts the record. MUST be called with a service-role client to bypass RLS.
Duplicate handling: If the r2Key already exists (unique constraint), the confirm endpoint returns 409 — the SOS generator should treat this as a no-op.

Vercel Deployment
Install script: scripts/vercel-install.sh runs npm ci and validates all required environment variables.
Required env vars are split into two groups:
  - Client-side (must have NEXT_PUBLIC_ prefix to be exposed to the browser):
      NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
  - Server-side (never exposed to the browser; used only in Vercel Route Handlers / Edge Functions):
      SUPABASE_SERVICE_ROLE_KEY,
      CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID,
      CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME,
      CLOUDFLARE_R2_PUBLIC_URL
  - Optional (external API sync — required for Spotify / Discogs / Songkick artist sync):
      SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET,
      DISCOGS_TOKEN, SONGKICK_API_KEY
  - Optional (YouTube sync):
      YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID, CRON_SECRET
  - Optional (SOS webhook — required for receiving PDF statements from the SOS generator):
      SOS_WEBHOOK_SECRET
  - Optional (Newsletter DOI — required for sending Double Opt-In confirmation emails):
      RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_SITE_URL
  - Optional (MailerLite — adds verified subscribers to the marketing list after DOI confirmation):
      MAILERLITE_API_KEY, MAILERLITE_GROUP_ID
Configure all variables in Vercel Dashboard → Project → Settings → Environment Variables.
See DEPLOYMENT.md for full variable descriptions and setup instructions.

Newsletter Double Opt-In (DOI) Flow
newsletter_subscribers stores each signup with status='pending' and a UUID verification_token until the user confirms.
Subscription entry point: `subscribeToNewsletter(formData)` Server Action in `src/actions/newsletter.ts`. The form in `NewsletterSection.tsx` calls this via React 19 Server Action invocation (no fetch, no route handler).
Email delivery: a Supabase Edge Function (`supabase/functions/newsletter-confirm/index.ts`, Deno runtime) is triggered by a Database Webhook on INSERT to `newsletter_subscribers`. It sends the DOI confirmation email via the Resend API.
Verification: `GET /api/newsletter/verify?token=<uuid>` looks up the pending row, flips status to 'subscribed', optionally syncs to MailerLite, and redirects to `/newsletter/confirmed`.
Anti-enumeration: duplicate email submissions return a silent success — the user is never told whether the address is already registered.
Legacy REST fallback: `POST /api/newsletter` (Route Handler) still accepts subscriptions for server-to-server integrations and testing; it follows the same pending+token pattern.
DAL: `createPendingSubscriber(db, email, token, name?)` and `verifySubscriberToken(db, token)` in `src/lib/api/newsletter.ts`. Both require a service-role client to bypass RLS.
Edge Function secrets (set in Supabase Dashboard → Edge Functions → Secrets): RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_SITE_URL.

Responsive Design & Layout Integrity
MANDATORY: All UI components MUST follow the rules below.

Mobile-First Only: Always build the mobile layout first using base Tailwind classes (without prefixes). Only scale up using sm:, md:, and lg: breakpoints. Never use desktop-first hacks like max-md:.

Fluidity over Fixed Dimensions: Never use hardcoded pixel dimensions (e.g., w-[500px], h-[300px]) for structural containers. Always use fluid utility classes (w-full, max-w-7xl, min-h-screen) or aspect ratios (aspect-video, aspect-square).

Bento/Grid Strategies: For high-density information (like the Artist Dashboard or Release Radar), use CSS Grid. Implement grid-auto-flow: dense to prevent "swiss cheese" empty gaps when grid items wrap on different screen sizes.

Zero Cumulative Layout Shift (CLS): Loading states (using shadcn/ui Skeletons) MUST use the exact same grid and flex structures as the fully loaded content.

Defensive Overflow: Prevent horizontal scrolling on mobile at all costs. Handle long texts or overflowing images gracefully using truncate, overflow-hidden, or break-words.

Visual Effects (Industrial Aesthetic)
The public site renders three non-interactive overlay layers — animated noise/grain, CRT scanlines, and a vignette — controlled by CMS settings.
The VisualEffectsOverlay component (src/components/VisualEffectsOverlay.tsx) is a dumb Client Component mounted in app/layout.tsx. It receives noiseOpacity, crtScanlinesEnabled, and vignetteIntensity as props from the Server Component parent (IoC).
All overlays use pointer-events: none and z-index 9996–9998 so they never block user interactions.
Settings are stored in the site_settings KV table (keys: noise_opacity, crt_scanlines_enabled, vignette_intensity, shopify_store_url, youtube_channel_id) and managed via the Admin CMS "Visual Effects" tab (Slider + Switch controls).
CSS animation keyframes (.noise-overlay, .scanlines-overlay) live in app/globals.css. Opacity/visibility is controlled via inline style props — never hardcoded.
CRITICAL DESIGN RULE: Do NOT use neon glows, bright highlights, or flashy cyberpunk effects. Keep the aesthetic raw, dark, industrial, and subtle.

Press & Media Ecosystem
Public EPK page: `app/press/page.tsx` (Server Component) fetches press_photos, artist profile bios (short/medium/long), concerts, and press_quote from Supabase. All photo display URLs pass through `getOptimizedImageUrl()` (wsrv.nl proxy); download links point to the original R2 public CDN URL.
Promo Pool: `/promo-pool/*` is a dual-gated journalist-only area.
  - Gate 1 (Edge Middleware): unauthenticated users are redirected to `/promo-pool/login`.
  - Gate 2 (Layout Server Component): authenticated users without role `journalist` or `admin` see `PromoPoolAccessGate` (shows application status or application form).
Anti-leak audio: `promo_tracks` stores only the R2 object key — NO public URL. The `getPromoTrackStreamUrl(r2Key)` Server Action in `src/actions/promoTrack.ts` verifies the journalist/admin role and returns a 15-minute presigned GET URL. The URL is only generated on explicit user click, never in initial HTML.
Admin EPK upload: `getEpkUploadUrl(category, filename, contentType)` in `src/actions/epkUpload.ts` generates a 15-minute presigned PUT URL for direct browser-to-R2 upload, bypassing Vercel's 4.5 MB limit. Categories: `press-photos` | `promo-tracks`.
Journalist applications: `journalist_applications` table; `POST /api/journalist-applications` lets anyone submit. `PATCH /api/journalist-applications/[id]` (admin-only) approves/rejects and updates `profiles.role` to `journalist` / `user`. Admin UI is in `src/components/admin/JournalistManager.tsx` (Media tab in AdminDashboard).
DAL: `src/lib/api/pressPhotos.ts`, `src/lib/api/promoTracks.ts`, `src/lib/api/journalistApplications.ts` — each with Vitest tests.
user_role enum: includes `journalist`, `artist` in addition to `admin`, `editor`, `user`. The `UserProfile` type in `src/types/index.ts` reflects all five values.
DB: Migration `20260510190000_press_and_promo_pool.sql` — adds journalist role value, press_photos, promo_tracks, journalist_applications tables with RLS.

Admin User Management
The **Users** tab in the AdminDashboard (`src/components/admin/AdminDashboard.tsx`) is only visible when `profile.role === 'admin'`. It renders `<UsersManager />`.
The **Features** tab is also admin-only — it renders `<FeatureTogglesManager />` to toggle `promoPool`, `sosStatements`, and `editorTools` globally.
Editor restriction: Editors (`role === 'editor'`) see only artists, releases, news, and videos tabs in the admin dashboard. Admin-only tabs (assets, settings, health, media, users, features) are hidden for editors. If `editorTools` feature toggle is disabled, editors are blocked from admin entirely with an "Editor Tools Disabled" gate.
Types: `UserRole` and `UserWithProfile` are in `src/types/users.ts`.
DAL: `src/lib/api/users.ts` exports `listUsersWithProfiles`, `updateUserRole`, `banUser`, `deleteUser`, `linkArtistToUser`, `unlinkArtistFromUser`. All functions accept a service-role `SupabaseClient`. Supabase Auth Admin API methods (`listUsers`, `updateUserById`, `deleteUser`) are called via the `adminClient.auth.admin` namespace.
Hook: `src/hooks/useUsers.ts` fetches from `GET /api/admin/users` and exposes `updateRole`, `toggleBan`, `deleteUser`, `linkArtist`, `unlinkArtist` with optimistic updates and toast notifications.
API Routes (all admin-only, use service-role client):
  - `GET /api/admin/users` — lists all users merged with profile roles and linked artist names.
  - `PATCH /api/admin/users/[id]` — updates `role` and/or `ban` status; rejects self-modification.
  - `DELETE /api/admin/users/[id]` — deletes user from Auth; profiles cascade. Rejects self-deletion.
  - `PATCH /api/admin/users/[id]/link-artist` — links or unlinks (`artistId: null`) an artist to a user. Validates no double-linking.
Security: Every route verifies `profiles.role = 'admin'` server-side via `createServerSupabaseClient()` before using the service-role client. The service-role key never reaches the browser.

Feature Toggles
There are now two feature-flag systems:
1) Global JSON toggles in `site_settings` key `feature_toggles` (`promoPool`, `sosStatements`, `editorTools`) managed by `FeatureTogglesManager`.
2) Role-targeted portal/journalist module flags in `portal_feature_flags` (e.g. `artist.tour`, `journalist.press_kit`) managed by `FeatureFlagsManager` and `PATCH /api/admin/feature-flags/[id]`.
Enforcement: Portal and press dashboard nav/routes read `portal_feature_flags`; legacy promo-pool/editor gates still read `site_settings.feature_toggles`.

Artist Portal Access Gate
Portal layout (`app/portal/layout.tsx`) enforces role-based access BEFORE rendering the portal UI:
  - Roles `artist` or `admin` → portal accessible (user must also have a linked artist record).
  - Role `user` (unassigned/new) → `PortalAccessGate` component shown — explains how to request access.
  - Other roles (`editor`, `journalist`) → `PortalAccessGate` shown with role explanation.
`PortalAccessGate` lives at `app/portal/_components/PortalAccessGate.tsx`.
New users default to `user` role = zero portal/admin access until an Admin explicitly assigns a role and links their artist profile.

Artist Preview
`PortalSidebar` accepts `artistSlug: string | null`, `featureFlags: Record<string, boolean>`, and `unreadMessages: number` props from the layout Server Component.
When `artistSlug` is set, a "Preview Public Profile" link is shown under the artist name (opens `/artists/{slug}` in a new tab).
The same preview link/button appears at the top of `ProfileForm` (passed via `artistSlug` prop from `portal/profile/page.tsx`).

Journalist Dashboard
Protected routes live at `/press/dashboard/*` with dedicated `/press/login`.
Middleware enforces auth and role (`journalist` or `admin`) before access.
Feature-flag-gated modules: promo pool, press kit, press releases, accreditation, download history.

Schema note
`supabase/reset.sql` remains the canonical idempotent schema script. This project now also contains migration patch `supabase/migrations/20260512000002_add_journalist_and_feature_flags.sql` for incremental rollout.
