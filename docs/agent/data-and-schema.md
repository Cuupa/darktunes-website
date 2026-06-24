# Data Layer & Schema

## Single Source of Truth

Single Source of Truth (SSOT) / Server State Synchronization / Reactivity — MANDATORY
All data displayed in the UI must originate from a single authoritative source — the Supabase database. The following principles are non-negotiable:
SSOT: Each piece of data has exactly one owner. The Supabase `site_settings` table is the sole source for CMS settings (Impressum, Datenschutz, Hero, SEO, etc.). Admin UI components read and write exclusively to the DB via DAL functions; they must never maintain a separate in-memory copy as the primary record.
Server State Synchronization: After any write to the database (upsert, insert, delete), the UI must immediately reflect the updated server state. For Next.js ISR pages (`unstable_cache`), the write path MUST call `/api/revalidate-site-settings` (or the relevant revalidation endpoint) so the ISR cache is purged and the next render shows fresh data. Stale data after a save is a defect.
Reactivity / Data Binding: Client components that display persisted data MUST react to server state changes. Use optimistic updates sparingly and only where latency matters; always reconcile with the server response. Hooks that fetch data (e.g., `useSiteSettings`) must re-fetch after a successful mutation so local state stays in sync with the DB.
Impressum & Datenschutz pages specifically: both pages use `unstable_cache` to fetch `site_settings`. The cache is invalidated by POSTing to `/api/revalidate-site-settings` after each admin save. The cache callback MUST use a cookie-free Supabase client (see the `unstable_cache` rule above) so that it works correctly during on-demand revalidation where no request-scoped cookies are available.

## Data Access Layer (DAL)

Data Access Layer (DAL)
All database queries live in `src/lib/api/` — one file per table (artists.ts, releases.ts, news.ts, videos.ts, assets.ts, artistAssets.ts, labelMessages.ts, artistReplies.ts, siteSettings.ts, artistProfiles.ts, streamingStats.ts, salesStatements.ts, newsletter.ts, pressKit.ts, promoTracks.ts, journalistApplications.ts, pageEvents.ts, merchOrders.ts, labelAnalytics.ts, promoImpact.ts, settlementLedger.ts, sosPeriodSummaries.ts, …). Press photo reads/writes use `assets` + `press_kit_items` via `pressKit.ts` (the legacy `press_photos` table exists in `reset.sql` for idempotent backfill only — no application DAL).
Every DAL function receives `SupabaseClient<Database>` as its first argument. Never import the global `supabase` singleton inside a DAL file.
DAL functions throw `new Error(error.message)` when Supabase returns an error. For `.single()` queries, error code `PGRST116` (not found) returns `null` instead of throwing.
Row-to-domain mappers: Use `rowTo*` functions to convert snake_case DB rows to camelCase domain types. Nullables map to `undefined` (optional fields) or `''` (required string fields) using `?? undefined` / `?? ''`.
Shared mappers: `src/lib/api/artistRowMapper.ts` exports `rowToArtist()` — used by both `artists.ts` and `artistProfiles.ts` to avoid duplication.
Site Settings DAL: `siteSettings.ts` uses `rowsToSettings()` (flat key-value rows → typed `SiteSettings` domain object) with hardcoded defaults as fallback. Use `upsertSiteSettings(db, record)` for batch saves from the Admin CMS. The `feature_toggles` key stores a JSON object (`FeatureToggles`) for global feature flags.
Hook Pattern: Hooks in `src/hooks/` wrap DAL functions. Each hook checks `isSupabaseConfigured` at load time — if false, immediately sets `isLoading = false` and returns empty data. This prevents Supabase calls when env vars are not set.
Next.js Route Handlers: API endpoints live at `app/api/*/route.ts`. The upload handler (`app/api/upload/route.ts`) requires admin or editor role. Never use the legacy `api/` directory for new endpoints.
Server-side Supabase Clients: Use `src/lib/supabase/server.ts` (createServerSupabaseClient) in Server Components and Route Handlers. Use `src/lib/supabase/client.ts` (createBrowserSupabaseClient) in Client Components.
Build stability note: `app/layout.tsx` uses CSS custom-property fallback font stacks (`--font-sans`, `--font-serif`, `--font-mono`) instead of `next/font/google` so CI and offline builds do not depend on external font fetches. Keep root typography deterministic and network-independent.
Server Env Validation: Import `src/lib/env.server.ts` in Route Handlers to get Zod-validated server-side environment variables. This module throws at startup if any required server var is missing. External integration API keys are **not** env vars — they live encrypted in `api_credentials` (DAL: `src/lib/api/apiCredentials.ts`, resolver: `src/lib/secrets/getExternalCredentials.ts`, crypto: `src/lib/secrets/credentialCrypto.ts`). Master key: `API_CREDENTIALS_ENCRYPTION_KEY` (Vercel env only). Admin UI: `/admin/api-keys`. Multi-tenant prep: `label_id UUID NULL` on `api_credentials` (NULL = default label).
Next.js Caching: In app/page.tsx, data is fetched using `unstable_cache` with explicit `revalidate: 60` and `tags`. This is required because Next.js 15 no longer caches fetch/GET by default.
CRITICAL — unstable_cache and Dynamic APIs: In Next.js 15, dynamic APIs such as `cookies()`, `headers()`, and `params` CANNOT be called inside `unstable_cache` callbacks. Any call to `createServerSupabaseClient()` (which calls `cookies()`) inside an `unstable_cache` callback will throw at runtime, causing `.catch(() => null)` guards to silently return null and trigger `notFound()` → 404. ALWAYS use a cookie-free client inside `unstable_cache`: `createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)`. For public read operations (artists, releases, site settings) the anon key + RLS is sufficient; no session cookie is needed.
Public vs Admin DAL: The public homepage (app/page.tsx) uses `getPublicArtists()`, `getPublicReleases()`, and `getPublicConcerts()` which filter by `is_visible = TRUE` and cascade that filter via artist linkage. `getPublicArtists()` is ordered by `featured DESC, name ASC` so the homepage Artists section can guarantee featured artists in the visible six-card shuffle. `getPublicReleases()` must also exclude promo-only content with `is_promo = FALSE` so Promo Pool releases never appear on the public homepage/Hero/carousels. Admin hooks use the unrestricted `getArtists()` / `getReleases()` / `getConcerts()` to see all records including hidden ones.

Detail Page Data API Waterfall
app/releases/[id]/page.tsx — Data API Waterfall:
  1. URL segment `id` → UUID of the release
  2. `getReleaseById(client, id)` → SELECT * FROM releases WHERE id = ? (RLS: anon sees visible releases with visible artists)
  3. `getDictionary(locale)` → resolved from NEXT_LOCALE cookie / Accept-Language header
  Steps 2+3 run in parallel via Promise.all. Cookie-free public client used inside unstable_cache (revalidate: 60, tag: 'releases').

app/artists/[slug]/page.tsx — Data API Waterfall:
  1. URL segment `slug` → artist slug
  2. `getArtistBySlug(client, slug)` → Stage 1 direct slug match; Stage 2 fallback scans rows with NULL/empty slug and matches the mapper-generated slug from artist name (RLS: anon sees visible artists)
  3. `getReleasesByArtistId` + `getConcertsByArtistId` + `getVideosByArtistId` + `getPublicNewsPostsByArtistId` → four parallel queries using the resolved artist.id (news capped at 3 most recent)
  4. `getDictionary(locale)` → locale resolution
  Steps 2+3+4 run concurrently after step 1 resolves. Cookie-free public client used with route-segment `revalidate = 60` (ISR) and `dynamicParams = true`.

## ISR Cache Tags

## ISR Cache Tag Naming Convention

Tags follow the pattern: lowercase table name as-is.
Multi-resource pages combine tags: `['artists', 'releases']`
Single-resource pages: `['releases', \`release-${id}\`]`

### List-level tags (invalidate all pages of this type)
  'artists' | 'releases' | 'news' | 'videos' | 'concerts'
  'site-settings' | 'artist-profiles' | 'sync-logs'

### Entity-level tags (invalidate only one specific page)
  `'artist-${slug}'`   → use in `app/artists/[slug]/page.tsx`
  `'release-${id}'`    → use in `app/releases/[id]/page.tsx`
  `'news-${slug}'`     → use in `app/news/[slug]/page.tsx`

All pages use BOTH a list-level and an entity-level tag so that either a
full-list revalidation or a targeted single-entity revalidation will bust them:
  `app/artists/[slug]`  → tags: `['artists', 'artist-${slug}']`
  `app/releases/[id]`   → tags: `['releases', 'release-${id}']`
  `app/news/[slug]`     → tags: `['news', 'news-${slug}']`

When calling revalidateTag() in a Route Handler after a write:
- Artist update: `revalidateTag('artists')` + `revalidateTag('artist-${slug}')`
- Release update: `revalidateTag('releases')` + `revalidateTag('release-${id}')`
- News update: `revalidateTag('news')` + `revalidateTag('news-${slug}')`

`POST /api/revalidate-content` accepts an optional `entityTags` array for
targeted Supabase Database Webhook-driven revalidation.
Adding an undocumented tag silently does nothing.

## R2 Object Keys

## Cloudflare R2 Object Key Naming Convention

ALL R2 keys MUST be stored in the corresponding DB column (`r2_key`) so that
`deleteObjectFromR2(r2Key)` can clean up when the DB record is deleted.

Key prefixes (NEVER deviate):
  artists/{artistId}/{uuid}.{ext}                         → artist images / logos
  releases/{releaseId}/{uuid}.{ext}                        → release cover art
  profile-photos/{artistId}/{uuid}.{ext}                   → portal profile photos
  release-covers/{artistId}/{uuid}.{ext}                   → portal-submitted release covers
  statements/{artistId}/{filename}                         → SOS royalty PDFs
  artist-assets/{artistId}/{uuid}.{ext}                    → artist-uploaded marketing files
  artist-documents/{artistId}/{uuid}_{originalFilename}    → portal document vault (PDF/DOCX contracts, GEMA, splits)
  press-kit/{category}/{uuid}.{ext}                        → EPK assets (press photos, etc.)
  promo-tracks/{uuid}.{ext}                                → journalist promo audio

## Deprecated Imports

## Deprecated Code — FORBIDDEN Imports

`src/lib/supabase.ts` — DEPRECATED. Creates a browser-singleton Supabase client.
DO NOT import from this file in any new code.

Replace with:
- Client Components: `createBrowserSupabaseClient()` from `@/lib/supabase/client`
- Server Components / Route Handlers: `createServerSupabaseClient()` from `@/lib/supabase/server`
- Service-role operations: pass `createServerSupabaseClient()` with SUPABASE_SERVICE_ROLE_KEY

## Database Schema Management

Database Schema Management
⛔ MIGRATION SCRIPTS ARE STRICTLY AND ABSOLUTELY FORBIDDEN. Never create files in `supabase/migrations/` or any incremental SQL patch files. Every agent or developer who creates a migration script violates this rule and must immediately delete it and move the change into `supabase/reset.sql`.
`supabase/reset.sql` and `src/types/database.ts` are the ONE AND ONLY source of truth for the database structure. They MUST always be in sync. There is only ONE schema script — the idempotent reset script.
Full schema requirements (3NF, naming conventions, RLS rules, idempotency patterns, audit rules) are documented in `supabase/DB_REQUIREMENTS.md`. Read it before making any schema changes.

MANDATORY RULE — Schema Change Checklist:
Every PR that adds, removes, or renames a column / table / enum MUST include ALL of the following:
  1. Updated `supabase/reset.sql` — add the column/table to the CREATE TABLE definition AND add an idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` guard so existing databases are updated safely.
  2. Updated `src/types/database.ts` to reflect the new schema (Row, Insert, Update shapes).
  3. If applicable: updated application hooks (src/hooks/use*.ts) that query the affected table.
  4. Verified compliance with `supabase/DB_REQUIREMENTS.md` (3NF, no transitive dependencies, RLS enabled).

Apply the schema to Supabase cloud: paste `supabase/reset.sql` into the Supabase SQL Editor and run it (fully idempotent — safe on fresh and existing databases).
Visibility & Cascading Deletes: `artists.is_visible` and `releases.is_visible` (both BOOLEAN DEFAULT TRUE) control public visibility. `releases.artist_id` uses `ON DELETE CASCADE` so deleting an artist removes all their releases automatically. RLS policies enforce visibility at the DB level for the public role; the DAL public functions (`getPublicArtists`, `getPublicReleases`, `getPublicConcerts`) enforce it additionally at the application layer.
Video ownership: `videos.artist_id UUID REFERENCES artists(id) ON DELETE SET NULL` links synced label-channel videos to artists. Artist profile pages fetch videos via `getVideosByArtistId()`; when no match exists, `artist_id` remains NULL and the homepage still shows latest videos globally.

Schema note
`supabase/reset.sql` is the sole, canonical, idempotent schema script. ⛔ There are NO migration files — `supabase/migrations/` MUST NOT exist. If any file exists there, delete it and fold the change into `reset.sql`.
Tables `artist_assets` and `artist_replies` are defined at the bottom of `reset.sql`.

## Database Schema Management (supabase/reset.sql) — MANDATORY

### Definition Order
Helper Functions MUST be defined BEFORE their first use in CREATE TABLE / CREATE POLICY / TRIGGER.
Required order in reset.sql:
  1. EXTENSIONS
  2. ENUM TYPES
  3. ALL HELPER FUNCTIONS (set_updated_at, handle_new_auth_user, handle_oauth_artist_verification,
     get_my_role, has_permission, and any future SECURITY DEFINER helpers)
  4. TABLES (CREATE TABLE IF NOT EXISTS + ALTER TABLE … ADD COLUMN IF NOT EXISTS guards)
  5. RLS POLICIES
  6. DATA BACKFILLS (INSERT … ON CONFLICT DO NOTHING)

### has_permission — Correct Call Signature
`public.has_permission(perm TEXT)` takes EXACTLY ONE ARGUMENT.
The function retrieves auth.uid() internally.
NEVER call `public.has_permission(auth.uid(), 'permission_name')` — that is the wrong signature.
  ✅ Correct:  public.has_permission('can_manage_releases')
  ❌ Wrong:    public.has_permission(auth.uid(), 'can_manage_releases')

### No Duplicate Column Declarations
If a column is already declared inside the CREATE TABLE block, do NOT add a redundant
ALTER TABLE … ADD COLUMN IF NOT EXISTS guard for the same column.
Guards are ONLY for columns added after the initial CREATE TABLE definition.

## Supabase Read Replica

Supabase Read Replica Client
`src/lib/supabase/replica.ts` exports `createReplicaSupabaseClient()`.
When `SUPABASE_REPLICA_URL` and `SUPABASE_REPLICA_ANON_KEY` are set (Supabase Pro plan, configure via Dashboard → Database → Replicas), this client is used for read-heavy queries: portal analytics charts, admin health dashboard, admin logs, SOS CSV exports. Falls back silently to the primary DB via `createBrowserSupabaseClient()` / `createServerSupabaseClient()` when env vars are unset — safe for all environments.
Never use the replica client for write operations (INSERT/UPDATE/DELETE) — it is read-only. Never use it inside `unstable_cache` callbacks (use the cookie-free anon client there instead).

## Analytics Gold Layer

Precomputed or normalised analytics tables (all in `supabase/reset.sql`, RLS: artist read own + admin/editor all):

| Table | Source | Persist path |
|---|---|---|
| `artist_territory_metrics` | SOS territory rollups | Accounting → Save to Portal |
| `streaming_stats` | Derived from territory metrics | Same persist |
| `sos_period_summaries` | SOS period totals | Same persist (optional) |
| `event_impact` | Concert ↔ stream correlation | Recomputed on persist |
| `promo_impact` | Promo log ↔ stream correlation | Recomputed on persist |
| `merch_orders` | Shopify/Darkmerch line items | Worker `buildMerchOrderRows` → persist |
| `page_events` | Public site navigation | `POST /api/page-events` (service role, consent-gated) |
| `epk_download_events` | EPK PDF exports | Export routes (fire-and-forget) |

Portal analytics (`/portal/analytics`) reads via authenticated `createServerSupabaseClient()` — not the read replica — so RLS artist scoping is correct.

