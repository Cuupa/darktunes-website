# Integration Summary — darkTunes Music Group

## What Is Implemented

### Public Website
- **Hero section** — featured release with dynamic background
- **Releases section** — fetched from iTunes API via `useItunesSync` hook; manual sync button
- **Spotify Player** — embedded iframe player for the label playlist
- **Artists section** — mock data (ready for Supabase integration)
- **Videos section** — YouTube embed gallery with video modal
- **News section** — mock data (ready for Supabase integration)
- **Header** — shrinking logo on scroll, navigation
- **Footer**
- **CRT scanline overlay** — full-page vintage aesthetic

### Infrastructure
- **Vite 7 + React 19 + TypeScript** build pipeline
- **Tailwind CSS v4** with custom darkTunes brand tokens in `src/index.css`
- **Framer Motion** for page animations and modal transitions
- **Lenis** smooth scrolling via single `LenisProvider` at root
- **Vitest** unit test suite (`npm test`)
- **ESLint** with TypeScript and React-Hooks rules
- **Vercel** deployment via `vercel.json` + `scripts/vercel-install.sh`
- **Supabase** client configured in `src/lib/supabase.ts`
- **Database schema** defined in `supabase/migrations/20240101000000_initial_schema.sql`
- **TypeScript DB types** in `src/types/database.ts`

### Admin Panel (scaffolded)
- Route: `/admin`
- Authentication via `useAuth` hook (Supabase Auth)
- Dashboard UI with tabbed interface
- Manager components for Artists, Releases, News, Videos, Assets

### Component Contracts
- `src/lib/component-contracts.ts` — `SectionProps`, `EditableSectionProps<T>`, `AdminPanelProps<T>`, `DialogProps`

---

## What Still Needs Wiring Up

| Feature | Status | Notes |
|---|---|---|
| Artists — live DB data | Pending | `mockArtists` used in App.tsx; swap to `useArtists` hook |
| News — live DB data | Pending | `mockNews` used in App.tsx; swap to `useNews` hook |
| Videos — live DB data | Pending | `mockVideos` used in App.tsx; swap to `useVideos` hook |
| Admin CRUD operations | Scaffolded | UI components present; Supabase queries to be wired |
| R2 file uploads | Pending | Requires Vercel Edge Function + env vars |
| Supabase RLS policies | Defined in migration | Needs cloud deployment |

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
| `src/lib/itunesApi.ts` | iTunes Search API client |
| `src/hooks/useItunesSync.ts` | iTunes sync hook with local storage caching |
| `src/hooks/useAuth.ts` | Supabase authentication hook |
| `src/lib/component-contracts.ts` | Shared prop interfaces (SectionProps, etc.) |
| `src/types/database.ts` | Generated TypeScript types from DB schema |
| `supabase/migrations/` | SQL migration files (source of truth) |

---

## Quick Start

```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, CLOUDFLARE_R2_* variables

npm ci
npm run dev
# → http://localhost:5173 (public site)
# → http://localhost:5173/admin (admin panel)
```
