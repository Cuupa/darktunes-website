# Integration Summary — darkTunes Music Group

## What Is Implemented

### Public Website
- **Hero section** — featured release with dynamic background
- **Releases section** — server-side fetched from Supabase via RSC + ISR (60s revalidate)
- **Spotify Player** — embedded iframe player for the label playlist
- **Artists section** — server-side data, passed as props to client component
- **Videos section** — YouTube embed gallery
- **News section** — server-side data from Supabase
- **Header** — shrinking logo on scroll, navigation (`"use client"`)
- **Footer** (`"use client"` for smooth scroll behaviour)
- **CRT scanline overlay** — full-page vintage aesthetic

### Infrastructure (Next.js 15 App Router)
- **Next.js 15 (App Router)** + React 19 + TypeScript — migrated from Vite SPA
- **Tailwind CSS v4** (PostCSS) with custom darkTunes brand tokens in `app/globals.css`
- **Framer Motion** for page animations and modal transitions
- **Lenis** smooth scrolling via single `LenisProvider` at root (`app/_components/Providers.tsx`)
- **Vitest** unit test suite (`npm test`) — 84 tests passing (9 test files)
- **ESLint** with TypeScript and React-Hooks rules
- **Vercel** deployment via `vercel.json` (framework: nextjs) + `scripts/vercel-install.sh`
- **Supabase SSR** client (`@supabase/ssr`) — server client in `src/lib/supabase/server.ts`, browser client in `src/lib/supabase/client.ts`
- **Edge Middleware** (`middleware.ts`) — auth protection for all `/admin/*` routes before page render
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
- `assets.ts` — `getAssets`, `createAssetRecord`, `deleteAssetRecord`
- Each DAL function receives `SupabaseClient<Database>` as first arg; fully unit-tested

### React Hooks (`src/hooks/`)
- `useArtists` — loads artists, exposes create/update/delete
- `useReleases` — loads releases, exposes create/update/delete + `syncFromItunes()`
- `useNews` — loads news posts, exposes create/update/delete
- `useVideos` — loads videos, exposes create/update/delete
- `useAssets` — loads assets, exposes createAssetRecord/deleteAssetRecord
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

### Artist Auto-Sync Pipeline (`src/lib/sync/`)
- `syncArtist.ts` — Core sync orchestrator with dependency-injected `SyncDeps` interface (db, fetch, uploadToR2). Fetches releases from iTunes API, caches cover art in Cloudflare R2, upserts releases to Supabase, writes a `sync_logs` entry. Never throws — errors are captured in `SyncResult.errors`.
- All external API calls use `withExponentialBackoff()` from `src/lib/rateLimiter.ts` for resilient retrying on 429/5xx responses.

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
| Spotify / Discogs / Songkick sync | 🔲 Pending | ID fields stored in DB; API integration pending API key setup |
| Supabase pg_cron auto-sync | 🔲 Pending | Schema and API route ready; pg_cron schedule setup needed in Supabase dashboard |

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
| `src/lib/supabase.ts` | Supabase client |
| `src/lib/api/` | Data Access Layer (DAL) for all tables |
| `src/lib/itunesApi.ts` | iTunes Search API client |
| `src/hooks/use*.ts` | React hooks wrapping DAL + state management |
| `src/hooks/useAuth.ts` | Supabase authentication hook |
| `src/lib/component-contracts.ts` | Shared prop interfaces (SectionProps, AdminPanelProps, etc.) |
| `src/types/database.ts` | TypeScript DB types (must stay in sync with migrations) |
| `src/components/admin/forms/` | Admin CRUD form components |
| `src/lib/api/syncLogs.ts` | DAL for sync_logs table (getSyncLogsByArtist, insertSyncLog) |
| `src/lib/rateLimiter.ts` | HttpError + withExponentialBackoff for resilient external API calls |
| `src/lib/imageUtils.ts` | wsrv.nl image proxy helpers (getOptimizedImageUrl, getSquareThumbnail) |
| `src/lib/r2Utils.ts` | R2 upload helper (createR2Client, uploadUrlToR2) |
| `src/lib/sync/syncArtist.ts` | Core artist sync orchestrator (IoC via SyncDeps) |
| `app/api/sync-artist/route.ts` | Manual sync trigger — POST /api/sync-artist |
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
