# Integration Summary — darkTunes Music Group

## What Is Implemented

### Public Website
- **Hero section** — featured release with dynamic background
- **Releases section** — fetched from Supabase via `useReleases` hook
- **Spotify Player** — embedded iframe player for the label playlist
- **Artists section** — live data from Supabase via `useArtists` hook
- **Videos section** — YouTube embed gallery via `useVideos` hook
- **News section** — live data from Supabase via `useNews` hook
- **Header** — shrinking logo on scroll, navigation
- **Footer**
- **CRT scanline overlay** — full-page vintage aesthetic

### Infrastructure
- **Vite 7 + React 19 + TypeScript** build pipeline
- **Tailwind CSS v4** with custom darkTunes brand tokens in `src/index.css`
- **Framer Motion** for page animations and modal transitions
- **Lenis** smooth scrolling via single `LenisProvider` at root
- **Vitest** unit test suite (`npm test`) — 59 tests passing
- **ESLint** with TypeScript and React-Hooks rules
- **Vercel** deployment via `vercel.json` + `scripts/vercel-install.sh`
- **Supabase** client configured in `src/lib/supabase.ts`
- **Database schema** defined in `supabase/migrations/20240101000000_initial_schema.sql`
- **TypeScript DB types** in `src/types/database.ts`

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

### Admin Panel (fully wired)
- Route: `/admin`
- Authentication via `useAuth` hook (Supabase Auth)
- Dashboard UI with tabbed interface
- **ArtistsManager** — table + create/edit dialog + delete confirm
- **ReleasesManager** — table + create/edit dialog + iTunes sync button
- **NewsManager** — table + create/edit dialog + delete confirm
- **VideosManager** — table + create/edit dialog + delete confirm
- **AssetsManager** — file upload form -> `/api/upload` (R2) + table + delete confirm

### Vercel Serverless Function
- `api/upload.ts` — POST endpoint that:
  1. Verifies `Authorization: Bearer <token>` via Supabase service-role key
  2. Parses multipart/form-data with `busboy`
  3. Uploads file to Cloudflare R2 via `@aws-sdk/client-s3`
  4. Returns `{ publicUrl, r2Key, filename, mimeType, sizeBytes }`

### Admin Form Components (`src/components/admin/forms/`)
- `ArtistForm` — 15 fields, auto-slug, featured/isEuNonGerman toggles
- `ReleaseForm` — cover art, type select, streaming URL fields
- `NewsForm` — title, auto-slug, excerpt, content, image, publish date
- `VideoForm` — youtubeId with auto-thumbnail generation

### Component Contracts
- `src/lib/component-contracts.ts` — `SectionProps`, `EditableSectionProps<T>`, `AdminPanelProps<T>`, `DialogProps`

---

## What Still Needs Wiring Up

| Feature | Status | Notes |
|---|---|---|
| Supabase RLS policies | Defined in migration | Needs cloud deployment via `npm run db:push` |
| R2 bucket CORS | Config needed | Allow `POST` from the Vercel domain |
| iTunes auto-sync on release | Optional | Manual sync button available in ReleasesManager |

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
| `api/upload.ts` | Vercel serverless function for R2 file uploads |
| `supabase/migrations/` | SQL migration files (source of truth for schema) |

---

## Quick Start

```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_R2_* variables

npm ci
npm run dev
# -> http://localhost:5173 (public site)
# -> http://localhost:5173/admin (admin panel)
```
