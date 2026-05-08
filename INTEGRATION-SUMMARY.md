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
- **Vitest** unit test suite (`npm test`) — 59 tests passing
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
- **ArtistsManager** — table + create/edit dialog + delete confirm
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
| `app/api/upload/route.ts` | Next.js Route Handler for R2 file uploads |
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
