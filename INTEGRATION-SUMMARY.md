# Integration Summary — darkTunes Music Group

## What Is Implemented

### Public Website
- **Hero section** — featured release with dynamic background; buttons functional (Listen Now → Spotify/player, Explore Artist → #artists)
- **Releases section** — server-side fetched from Supabase via RSC + ISR (60s revalidate); semantic `<ul>/<li>` grid; `useReducedMotion` support
- **Spotify Player** — embedded iframe player for the label playlist
- **Artists section** — server-side data, passed as props to client component; semantic `<ul>/<li>` grid; full ARIA on icon links; 44×44px touch targets; `useReducedMotion` support
- **Videos section** — YouTube embed gallery; semantic `<ul>/<li>` grid; image proxy via wsrv.nl; `useReducedMotion` support
- **News section** — server-side data from Supabase; semantic `<ul>/<li>` list; "Read Full Story" links to `/news/${slug}`; `useReducedMotion` support
- **Tour section** — upcoming concert dates from Supabase with ticket links
- **Header** — shrinking logo on scroll, navigation, Lenis smooth scroll, full ARIA (nav label, mobile toggle aria-expanded/controls, mobile nav id), 44px touch targets (`"use client"`)
- **Footer** — Lenis smooth scroll, footer nav wrapped in `<nav aria-label="Footer navigation">`, aria-labels on social icons (`"use client"`)
- **CRT scanline overlay** — full-page vintage aesthetic
- **WCAG 2.1 AA/AAA compliance** — skip navigation link in `app/layout.tsx`, `id="main-content"` on `<main>`, `useReducedMotion` in all animated sections, descriptive alt text, icon aria-labels, 44×44px touch targets, semantic lists

### Infrastructure (Next.js 15 App Router)
- **Next.js 15 (App Router)** + React 19 + TypeScript — migrated from Vite SPA
- **Tailwind CSS v4** (PostCSS) with custom darkTunes brand tokens in `app/globals.css`
- **Framer Motion** for page animations and modal transitions
- **Lenis** smooth scrolling via single `LenisProvider` at root (`app/_components/Providers.tsx`). Uses `ReactLenis` from `lenis/react` (root mode) so `useLenis()` is available anywhere in the tree. `useLenis` re-exported from `src/components/animations/LenisProvider.tsx`.
- **Vitest** unit test suite (`npm test`) — 147 tests passing (18 test files)
- **ESLint** with TypeScript and React-Hooks rules
- **Vercel** deployment via `vercel.json` (framework: nextjs) + `scripts/vercel-install.sh`
- **Supabase SSR** client (`@supabase/ssr`) — server client in `src/lib/supabase/server.ts`, browser client in `src/lib/supabase/client.ts`
- **Edge Middleware** (`middleware.ts`) — auth protection for all `/admin/*` and `/portal/*` routes before page render; also detects locale from `Accept-Language` header and sets `NEXT_LOCALE` cookie
- **Internationalisation (i18n)** — `src/i18n/` custom dictionary pattern; `en.json` + `de.json`; `getDictionary.ts` loads server-side; RSCs pass dict as props to Client Components (IoC); Header has DE/EN locale switcher
- **Database schema** defined in `supabase/migrations/20240101000000_initial_schema.sql`
- **TypeScript DB types** in `src/types/database.ts`

### Environment Validation
- **Client-side** (`src/env.ts`) — Zod schema for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; warns in dev/prod, returns null if missing (graceful degradation)
- **Server-side** (`src/lib/env.server.ts`) — Zod schema for all server-only vars; throws at startup if any required variable is missing

### Data Access Layer (`src/lib/api/`)
- `artists.ts` — CRUD for artists table
- `releases.ts` — CRUD + `upsertReleaseByItunesId` for iTunes sync
- `news.ts` — CRUD for news_posts table
- `videos.ts` — CRUD for videos table
- `concerts.ts` — read upcoming concerts from concerts table
- `assets.ts` — `getAssets`, `createAssetRecord`, `deleteAssetRecord`
- `siteSettings.ts` — `getSiteSettings` (returns typed `SiteSettings`), `upsertSiteSetting`, `upsertSiteSettings` (batch)
- Each DAL function receives `SupabaseClient<Database>` as first arg; fully unit-tested

### React Hooks (`src/hooks/`)
- `useArtists` — loads artists, exposes create/update/delete
- `useReleases` — loads releases, exposes create/update/delete + `syncFromItunes()`
- `useNews` — loads news posts, exposes create/update/delete
- `useVideos` — loads videos, exposes create/update/delete
- `useAssets` — loads assets, exposes createAssetRecord/deleteAssetRecord
- `useSiteSettings` — loads site settings, exposes `saveSettings()` + cache revalidation
- All hooks check `isSupabaseConfigured` and short-circuit gracefully in dev

### Admin Panel (Next.js App Router)
- Route: `/admin` (dynamic, server-rendered on demand, protected by Edge Middleware)
- Route: `/admin/login` (dynamic, server-rendered on demand)
- Authentication via `useAuth` hook (Supabase Auth)
- Dashboard UI with tabbed interface
- **ArtistsManager** — table + create/edit dialog + delete confirm + **"Sync Now"** per-artist button + skeleton loading states + last-synced-at display
- **ReleasesManager** — table + create/edit dialog + iTunes sync button
- **NewsManager** — table + create/edit dialog + delete confirm
- **VideosManager** — table + create/edit dialog + delete confirm
- **AssetsManager** — file upload form → `/api/upload` (R2 Route Handler) + table + delete confirm
- **SiteSettingsManager** — tabbed form (Global / Social Links / Homepage / SEO / Legal / DSGVO / Visual Effects) with Zod validation; Homepage tab supports both a fallback Spotify playlist URI and a multi-playlist array (label + URI) for instant tab switching. Saves all settings to Supabase and revalidates the Next.js ISR cache via `/api/revalidate-site-settings`. Follows IoC pattern: accepts `value: SiteSettings` and `onChange` props; `useSiteSettings` is wired in `AdminDashboard`.

### SOS Webhook — Statement of Sales PDF Upload
- `POST /api/webhooks/sos` — Step 1: Validates `SOS_WEBHOOK_SECRET` API key, verifies artist, generates a 15-minute presigned R2 PUT URL. Returns `{ uploadUrl, r2Key }`.
- `POST /api/webhooks/sos/confirm` — Step 2: Validates API key, inserts `sales_statements` row via service-role client. Returns `{ statementId }`.
- `createSalesStatement(db, data)` DAL function in `src/lib/api/salesStatements.ts`.
- `generatePresignedUploadUrl(r2Key, contentType, deps)` in `src/lib/portal/presignedUrl.ts` (15-min PUT URL).
- Bypasses Vercel's 4.5 MB request body limit — PDFs go directly from SOS generator → R2.

### File Upload (Next.js Route Handler)
- `app/api/upload/route.ts` — POST Route Handler that:
  1. Verifies `Authorization: Bearer <token>` via Supabase service-role key
  2. Parses multipart/form-data (native Next.js `FormData` API)
  3. Uploads file to Cloudflare R2 via `@aws-sdk/client-s3`
  4. Returns `{ publicUrl, r2Key, filename, mimeType, sizeBytes }`

### Admin Form Components (`src/components/admin/forms/`)
- `ArtistForm` — 15 fields, auto-slug, featured/isEuNonGerman toggles
- `ReleaseForm` — cover art, type select, streaming URL fields
- `NewsForm` — title, auto-slug, excerpt, content, image, publish date
- `VideoForm` — youtubeId with auto-thumbnail generation

### Multi-API Sync Engine (`src/lib/sync/`)
- **`syncAll.ts`** — Multi-artist, multi-API orchestrator. Runs iTunes, Spotify, Discogs, Songkick, Bandsintown, and Odesli sync for every artist. Accepts `SyncAllDeps` (extends `SyncDeps` with optional `spotify`, `discogsToken`, `songkickApiKey`, `bandsintownAppId`). Never throws — errors captured per-API in `SyncAllResult`.
- **`spotifyApi.ts`** — Fetches artist albums via Spotify Web API (client credentials flow). Returns `SpotifyRelease[]` with cover art URLs, popularity scores, and UPC barcodes.
- **`discogsApi.ts`** — Fetches physical releases from Discogs API (Personal Access Token). Paginated. Returns catalog numbers and barcodes.
- **`songkickApi.ts`** — Fetches upcoming concerts from Songkick API. Paginated. Returns `SongkickConcert[]` with venue, city, country, date, and ticket URL.
- **`bandsintownApi.ts`** — Fetches upcoming concerts from Bandsintown API v3. Returns `BandsintownConcert[]` with venue, city, country, date, and ticket URL.
- **`odesliApi.ts`** — Resolves any music streaming URL through Odesli (song.link) to return a universal smart link plus per-platform URLs.
- **`deduplication.ts`** — Merges Spotify (digital) and Discogs (physical) release lists using ISRC → barcode/UPC → normalised title + year as matching precedence.

### Centralized Error Handling (`src/lib/errors.ts`)
- **`ApiError`** — Structured HTTP error class with `status`, `message`, and optional `code`.
- **`withErrorHandler(handler)`** — Higher-Order Function that wraps any Next.js Route Handler. Catches `ApiError` (returns its status), `ZodError` (returns 400 with `VALIDATION_ERROR` code), and unknown errors (returns 500). All errors returned as `{ error, code, status }` JSON.

### API Routes
- **`POST /api/sync`** — Triggers full multi-API sync for all artists. Requires `Authorization: Bearer <token>`. Uses `withErrorHandler`.
- **`GET /api/health`** — Returns database connection status (latency ms), per-API last-sync timestamp and status, and rate-limit warnings. Public endpoint.

### Admin Health Dashboard
- **`SystemHealthWidget`** (`src/components/admin/SystemHealthWidget.tsx`) — Grid of status cards (DB online/offline, per-API last sync, rate-limit badges) with a "Force Sync All" button. Auto-refreshes every 60 seconds.
- Added **System Health** tab to `AdminDashboard.tsx`.

### Error Boundaries
- **`app/error.tsx`** — Next.js error boundary for route segments; shows a retry button.
- **`app/global-error.tsx`** — Global error boundary for layout-level failures; includes `<html>` and `<body>`.

### Rate Limiter (`src/lib/rateLimiter.ts`)
- `HttpError` — HTTP error class with a `status` code; used to distinguish retryable (429, 5xx) from non-retryable (4xx) failures.
- `withExponentialBackoff(fn, maxRetries, baseDelayMs)` — Retries `fn` with exponential back-off delays. Non-`HttpError` errors and non-retryable HTTP errors fail immediately.

### Image Optimisation (`src/lib/imageUtils.ts`)
All public-facing images MUST be served through wsrv.nl:
- `getOptimizedImageUrl(url, width)` — Returns a wsrv.nl URL that serves the image at the given width in WebP format.
- `getSquareThumbnail(url, size)` — Returns a wsrv.nl URL for a square cover-crop thumbnail in WebP.
Use these functions wherever `<img>` or Next.js `<Image>` displays an artist photo or release cover art.

### R2 Upload Helper (`src/lib/r2Utils.ts`)
- `createR2Client(accountId, keyId, secret)` — Creates a pre-configured AWS S3 client pointed at Cloudflare R2.
- `uploadUrlToR2(imageUrl, s3, bucket, r2PublicUrl, keyPrefix, fetchFn)` — Downloads a remote image and uploads it to R2, returning the public CDN URL.

### Sync Service Pattern
Complex sync logic lives in `src/lib/sync/` with a dependency-injected `SyncDeps` interface:
```typescript
interface SyncDeps {
  db: SupabaseClient<Database>   // Supabase service-role client
  fetch: typeof fetch             // Injectable fetch for external APIs
  uploadToR2: (imageUrl: string, keyPrefix: string) => Promise<string>
}
```
The HTTP handler in `app/api/sync-artist/route.ts` only wires real deps and calls `syncArtist()`. Tests mock all deps.

### Sync Logs DAL (`src/lib/api/syncLogs.ts`)
- `getSyncLogsByArtist(db, artistId, limit)` — Fetches recent sync history for an artist.
- `insertSyncLog(db, log)` — Records a sync result.

### Manual Sync API (`app/api/sync-artist/route.ts`)
- POST `/api/sync-artist` with body `{ artistId: string }` and `Authorization: Bearer <token>` header.
- Verifies the caller is authenticated, runs the sync pipeline, returns `SyncResult`.

---

## What Still Needs Wiring Up

| Feature | Status | Notes |
|---|---|---|
| iTunes auto-sync on artist create | ✅ Implemented | Manual "Sync Now" per artist in ArtistsManager; POST /api/sync-artist |
| Image caching in R2 | ✅ Implemented | Cover art from iTunes is downloaded & uploaded to R2 via uploadUrlToR2 |
| wsrv.nl image proxy | ✅ Implemented | getOptimizedImageUrl / getSquareThumbnail in src/lib/imageUtils.ts |
| Rate limiter + exponential backoff | ✅ Implemented | withExponentialBackoff in src/lib/rateLimiter.ts |
| Sync history logging | ✅ Implemented | sync_logs table + getSyncLogsByArtist DAL |
| Spotify / Discogs / Songkick / Bandsintown sync | ✅ Implemented | `src/lib/sync/{spotifyApi,discogsApi,songkickApi,bandsintownApi,odesliApi,deduplication,syncAll}.ts`; POST `/api/sync` |
| Visual Effects overlays (noise, scanlines, vignette) | ✅ Implemented | `VisualEffectsOverlay` in `app/layout.tsx`; settings stored in `site_settings` KV table; controlled from Admin "Visual Effects" tab |
| Site settings CMS | ✅ Implemented | `site_settings` table + Admin Settings tab + Next.js ISR cache revalidation |
| Impressum page (§ 5 TMG) | ✅ Implemented | `/impressum` RSC — all mandatory German legal fields from CMS |
| Datenschutzerklärung page | ✅ Implemented | `/datenschutz` RSC — Markdown content editable in CMS |
| GDPR Consent Management | ✅ Implemented | `ConsentBanner` + `ConsentGate` — Spotify/YouTube blocked until opt-in |
| Newsletter subscription | ✅ Implemented | Double Opt-In flow: Server Action → Supabase (pending) → Edge Function (Resend email) → `/api/newsletter/verify` (subscribed) → optional MailerLite sync |
| Generic cache revalidation webhook | ✅ Implemented | `POST /api/revalidate` with `REVALIDATE_SECRET` — for Supabase webhooks |
| Release detail pages | ✅ Implemented | `/releases/[id]` RSC + Framer Motion Shared Layout Animation |
| Artist Portal — auth + routing | ✅ Implemented | `/portal/*` protected by Edge Middleware; `/portal/login` login page |
| Artist Portal — EPK profile editor | ✅ Implemented | `artist_profiles` table + RLS + Profile form with bio_short/medium/long + photo upload via R2 |
| Artist Portal — streaming analytics | ✅ Implemented | `streaming_stats` table + RLS + StreamingChart (Recharts BarChart + platform summary cards) |
| Artist Portal — royalty statements | ✅ Implemented | `sales_statements` table + RLS + StatementsTable + presigned URL Server Action (5 min TTL) |
| Artist Portal — tour dates | ✅ Implemented | `/portal/tour` — upcoming concerts via `getConcertsByArtistId()` + TourList client component |
| Artist Portal — release management + checklist | ✅ Implemented | `/portal/releases` — `release_checklists` table + RLS + expandable release cards with progress bar + PATCH `/api/portal/checklist` |
| Artist Portal — marketing & smart links | ✅ Implemented | `/portal/marketing` — SmartLinks client component with copy-to-clipboard per release |
| SOS webhook — PDF upload from external generator | ✅ Implemented | 2-step presigned URL flow: POST /api/webhooks/sos (get PUT URL) + POST /api/webhooks/sos/confirm (create DB record). Requires `SOS_WEBHOOK_SECRET`. |
| Artist Portal — multi-tenant DB security | ✅ Implemented | `artists.user_id` → `auth.users(id)`; all portal tables use row-level `auth.uid()` policies |
| Artist social/shop links | ✅ Implemented | `facebook_url`, `twitter_url`, `tiktok_url`, `bandcamp_url`, `shop_url` columns in `artists` table; icon buttons in public artist cards + modal + admin form |
| News full page + detail page | ✅ Implemented | `/news` RSC with pagination via `ContentPagination`; `/news/[slug]` RSC detail page with `getNewsPostBySlug` DAL |
| Contact page + API route | ✅ Implemented | `/contact` RSC with SubmitHub link; `POST /api/contact` (Zod, honeypot, Resend delivery); `CONTACT_EMAIL` env var |
| SubmitHub link | ✅ Implemented | Footer → "Submit Your Music" link + Contact page SubmitHub section |
| Shopify/Darkmerch shop link | ✅ Implemented | `shopifyStoreUrl` in `SiteSettings` (`site_settings` KV key `shopify_store_url`); conditional display in Footer |
| YouTube API video sync | ✅ Implemented | `src/lib/api/youtubeApi.ts` + `POST /api/sync-youtube`; requires `YOUTUBE_API_KEY` + `YOUTUBE_CHANNEL_ID` |
| ContentPagination component | ✅ Implemented | `src/components/ContentPagination.tsx` — reusable shadcn-based paginator with ellipsis support |

---

## File Reference

| File | Purpose |
|---|---|
| `README.md` | Project overview, quick start, scripts |
| `DEPLOYMENT.md` | Full deployment guide (Vercel, Supabase, R2) |
| `ADMIN.md` | Admin panel usage documentation |
| `AGENTS.md` | Coding conventions and agent workflow rules |
| `.env.example` | Required environment variables template |
| `vercel.json` | Vercel build/deploy configuration |
| `scripts/vercel-install.sh` | Vercel install hook (npm ci + env var check) |
| `src/lib/supabase/client.ts` | Browser Supabase client (`@supabase/ssr`, cookie-based session) |
| `src/lib/supabase/server.ts` | Server Supabase client (`@supabase/ssr`, reads auth cookies) |
| `src/lib/supabase.ts` | Legacy Supabase client (deprecated; kept for backward compatibility) |
| `src/lib/api/` | Data Access Layer (DAL) for all tables |
| `src/lib/itunesApi.ts` | iTunes Search API client |
| `src/hooks/use*.ts` | React hooks wrapping DAL + state management |
| `src/hooks/useAuth.ts` | Supabase authentication hook |
| `src/lib/component-contracts.ts` | Shared prop interfaces (SectionProps, AdminPanelProps, etc.) |
| `src/types/database.ts` | TypeScript DB types (must stay in sync with migrations) |
| `src/components/admin/forms/` | Admin CRUD form components |
| `src/lib/api/syncLogs.ts` | DAL for sync_logs table (getSyncLogsByArtist, insertSyncLog) |
| `src/lib/api/siteSettings.ts` | DAL for site_settings table (getSiteSettings, upsertSiteSetting, upsertSiteSettings) |
| `src/lib/rateLimiter.ts` | HttpError + withExponentialBackoff for resilient external API calls |
| `src/lib/imageUtils.ts` | wsrv.nl image proxy helpers (getOptimizedImageUrl, getSquareThumbnail) |
| `src/lib/r2Utils.ts` | R2 upload helper (createR2Client, uploadUrlToR2) |
| `src/lib/sync/syncArtist.ts` | Core iTunes artist sync orchestrator (IoC via SyncDeps) |
| `src/lib/sync/syncAll.ts` | Multi-API orchestrator (iTunes + Spotify + Discogs + Songkick + Odesli) |
| `src/lib/sync/spotifyApi.ts` | Spotify Web API integration (albums, popularity, cover art) |
| `src/lib/sync/discogsApi.ts` | Discogs API integration (physical releases, catalog numbers, barcodes) |
| `src/lib/sync/songkickApi.ts` | Songkick API integration (concerts, venues, ticket links) |
| `src/lib/sync/bandsintownApi.ts` | Bandsintown API v3 integration (concerts, venues, ticket links) |
| `src/lib/sync/odesliApi.ts` | Odesli API integration (universal smart links via song.link) |
| `src/lib/sync/deduplication.ts` | ISRC/barcode deduplication utility for merging Spotify + Discogs releases |
| `src/lib/errors.ts` | `ApiError` class + `withErrorHandler` HOF for centralized error handling |
| `app/api/sync/route.ts` | Manual all-artists sync trigger — POST /api/sync |
| `app/api/sync-artist/route.ts` | Manual single-artist sync trigger — POST /api/sync-artist |
| `app/api/health/route.ts` | System health check — GET /api/health |
| `app/error.tsx` | Next.js error boundary (route-segment level) |
| `app/global-error.tsx` | Next.js global error boundary (root layout level) |
| `src/components/admin/SystemHealthWidget.tsx` | Admin health dashboard widget (DB status + per-API cards + Force Sync) |
| `app/api/revalidate-site-settings/route.ts` | Cache revalidation — POST /api/revalidate-site-settings (admin-only) |
| `src/lib/portal/presignedUrl.ts` | Presigned URL generators: download (GET, 5 min) + upload (PUT, 15 min) with injected deps |
| `app/api/webhooks/sos/route.ts` | SOS webhook Step 1 — generate presigned R2 PUT URL |
| `app/api/webhooks/sos/confirm/route.ts` | SOS webhook Step 2 — insert sales_statements DB record |
| `app/api/sync-youtube/route.ts` | YouTube video sync — POST /api/sync-youtube (requires YOUTUBE_API_KEY + YOUTUBE_CHANNEL_ID) |
| `src/lib/api/youtubeApi.ts` | YouTube Data API v3 utility — `fetchYouTubeChannelVideos(channelId, apiKey, maxResults)` |
| `app/news/page.tsx` | Public news list RSC — paginated via ContentPagination |
| `app/news/[slug]/page.tsx` | Public news detail RSC — `getNewsPostBySlug` DAL |
| `app/contact/page.tsx` | Contact page RSC with SubmitHub integration section |
| `app/api/contact/route.ts` | Contact form handler — POST (Zod, honeypot, Resend delivery, `CONTACT_EMAIL`) |
| `src/components/ContentPagination.tsx` | Reusable shadcn-based page navigator with ellipsis support |
| `supabase/migrations/` | SQL migration files (source of truth for schema) |

---

## Quick Start

```bash
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_R2_* variables

npm ci
npm run dev
# -> http://localhost:3000 (public site)
# -> http://localhost:3000/admin (admin panel)
```
