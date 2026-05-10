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

Unit Testing & Quality Assurance
Unit Testing: Write unit tests for all new utilities, API routes, and complex hooks using Vitest.
Test runner: `npm test` (runs `vitest run --config vitest.config.ts`), watch mode: `npm run test:watch`.
Test setup file: src/test/setup.ts – imports @testing-library/jest-dom matchers.
Test files live alongside their source files: src/**/*.{test,spec}.{ts,tsx}.
Test Isolation: Tests must not rely on external network requests. Mock all external APIs (including iTunes, Bandsintown, Odesli, Spotify, and Discogs).
Supabase Mock Pattern: In DAL tests, create a mock builder where all chain methods (select, order, insert, update, delete, upsert, eq, single) return `this` via `vi.fn().mockReturnThis()`. The builder object has `then`, `catch`, `finally` bound to a `Promise.resolve({data, error})`. This makes the entire chain thenable — `await db.from('x').select().order()` resolves correctly.

Data Access Layer (DAL)
All database queries live in `src/lib/api/` — one file per table (artists.ts, releases.ts, news.ts, videos.ts, assets.ts, siteSettings.ts, artistProfiles.ts, streamingStats.ts, salesStatements.ts).
Every DAL function receives `SupabaseClient<Database>` as its first argument. Never import the global `supabase` singleton inside a DAL file.
DAL functions throw `new Error(error.message)` when Supabase returns an error. For `.single()` queries, error code `PGRST116` (not found) returns `null` instead of throwing.
Row-to-domain mappers: Use `rowTo*` functions to convert snake_case DB rows to camelCase domain types. Nullables map to `undefined` (optional fields) or `''` (required string fields) using `?? undefined` / `?? ''`.
Shared mappers: `src/lib/api/artistRowMapper.ts` exports `rowToArtist()` — used by both `artists.ts` and `artistProfiles.ts` to avoid duplication.
Site Settings DAL: `siteSettings.ts` uses `rowsToSettings()` (flat key-value rows → typed `SiteSettings` domain object) with hardcoded defaults as fallback. Use `upsertSiteSettings(db, record)` for batch saves from the Admin CMS.
Hook Pattern: Hooks in `src/hooks/` wrap DAL functions. Each hook checks `isSupabaseConfigured` at load time — if false, immediately sets `isLoading = false` and returns empty data. This prevents Supabase calls when env vars are not set.
Next.js Route Handlers: API endpoints live at `app/api/*/route.ts`. The upload handler (`app/api/upload/route.ts`) uses `SUPABASE_SERVICE_ROLE_KEY` to verify Bearer tokens via `supabase.auth.getUser(token)` before processing uploads. Never use the legacy `api/` directory for new endpoints.
Server-side Supabase Clients: Use `src/lib/supabase/server.ts` (createServerSupabaseClient) in Server Components and Route Handlers. Use `src/lib/supabase/client.ts` (createBrowserSupabaseClient) in Client Components.
Server Env Validation: Import `src/lib/env.server.ts` in Route Handlers to get Zod-validated server-side environment variables. This module throws at startup if any required server var is missing.
Next.js Caching: In app/page.tsx, data is fetched using `unstable_cache` with explicit `revalidate: 60` and `tags`. This is required because Next.js 15 no longer caches fetch/GET by default.

Inversion of Control (IoC) & Component Contracts
Props Over State: UI components MUST receive all data and callbacks as props — they must not directly access global state, context, or external stores.
No Direct Context Reads: Components that render UI (sections, cards, widgets) must receive their data via props. Context access is only permitted in top-level wiring components (e.g., App.tsx, AdminPanel.tsx, use-app-state.ts).
Section Contracts: All page sections must extend SectionProps (or EditableSectionProps<T>) from src/lib/component-contracts.ts. The editMode, sectionLabels, and onLabelChange props are mandatory.
Admin Panel Contracts: All admin sub-forms must extend AdminPanelProps<T> from src/lib/component-contracts.ts. No sub-form should import or read AdminSettings directly from storage/context.
Dialog Contracts: All modals must extend DialogProps (with open / onClose). No dialog should manage its own visibility state internally.

Rate Limiting
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
`sync_logs` also records `api_source` (itunes | spotify | discogs | songkick | odesli | all) and `rate_limited` (boolean) per run.
The full multi-API orchestrator lives in `src/lib/sync/syncAll.ts` (SyncAllDeps extends SyncDeps with optional spotify/discogsToken/songkickApiKey). Called by `POST /api/sync`.
Release deduplication: `src/lib/sync/deduplication.ts` merges Spotify + Discogs releases using ISRC → barcode/UPC → normalised title + year precedence.

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
The SQL migration files and the TypeScript database types are the dual source of truth for the database structure. They MUST always be in sync.

MANDATORY RULE — Schema Change Checklist:
Every PR that adds, removes, or renames a column / table / enum MUST include ALL of the following:
  1. A new SQL migration file in supabase/migrations/ named YYYYMMDDHHMMSS_short_description.sql.
  2. Updated src/types/database.ts to reflect the new schema (Row, Insert, Update shapes).
  3. If applicable: updated application hooks (src/hooks/use*.ts) that query the affected table.

Never edit the initial migration (20240101000000_initial_schema.sql) directly — always add a new migration file.
Apply migrations to Supabase cloud: npm run db:push (requires Supabase CLI and supabase link).
Generate a diff between local and remote schema: npm run db:diff.
Migration naming: use UTC timestamp prefix, e.g. 20240601120000_add_artist_bandcamp_url.sql.

Artist Portal (Multi-Tenant)
The Artist Portal lives at `/portal/*` — a secure dashboard for the label's bands.
Auth: `middleware.ts` protects all `/portal/*` routes (except `/portal/login`) using the same Supabase session-cookie pattern as `/admin/*`.
Multi-tenancy: `artists.user_id UUID REFERENCES auth.users(id)` links each artist row to a Supabase Auth user. One auth user ↔ one artist.
Portal DAL functions: `getArtistByUserId(db, userId)` in `src/lib/api/artistProfiles.ts` resolves the current user's linked artist. Always call this before accessing artist-scoped data.
RLS enforcement: `artist_profiles`, `streaming_stats`, and `sales_statements` all have RLS policies that use `EXISTS (SELECT 1 FROM artists WHERE id = artist_id AND user_id = auth.uid())`. Security is at the DB layer; no middleware-only filtering.
Presigned URL pattern: `src/lib/portal/presignedUrl.ts` exposes two injectable functions:
  - `generatePresignedDownloadUrl(r2Key, deps)` — 5-minute GET URL for artist downloads (`PresignedUrlDeps`)
  - `generatePresignedUploadUrl(r2Key, contentType, deps)` — 15-minute PUT URL for the SOS PDF generator to upload directly to R2, bypassing Vercel's 4.5 MB body limit (`PresignedUploadUrlDeps`)
  The Server Action `app/portal/statements/_actions/presignedUrl.ts` wires real deps for artist-facing downloads.
Photo upload: `app/api/portal/upload-photo/route.ts` accepts `multipart/form-data`, verifies auth, confirms artist ownership, then uploads to `profile-photos/{artistId}/{uuid}.{ext}` in R2. Max 5 MB, image types only.
IoC in portal: Every portal page is a Server Component that fetches data and passes it as props to a `"use client"` leaf component. Leaf components never call `fetch` or Supabase directly.

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
  - Optional (SOS webhook — required for receiving PDF statements from the SOS generator):
      SOS_WEBHOOK_SECRET
Configure all variables in Vercel Dashboard → Project → Settings → Environment Variables.
See DEPLOYMENT.md for full variable descriptions and setup instructions.

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
Settings are stored in the site_settings KV table (keys: noise_opacity, crt_scanlines_enabled, vignette_intensity) and managed via the Admin CMS "Visual Effects" tab (Slider + Switch controls).
CSS animation keyframes (.noise-overlay, .scanlines-overlay) live in app/globals.css. Opacity/visibility is controlled via inline style props — never hardcoded.
CRITICAL DESIGN RULE: Do NOT use neon glows, bright highlights, or flashy cyberpunk effects. Keep the aesthetic raw, dark, industrial, and subtle.
