# darkTunes Music Group — Website

Official website for **darkTunes Music Group**, an alternative music label.  
Built with **Next.js 15 (App Router)**, React, Supabase, Cloudflare R2, and Tailwind CSS v4.

---

## 🎵 Features

- **Public site** – Hero, Releases (iTunes sync), Artists, Videos, News, Tour dates, Spotify Player
- **Artist Portal** – Secure multi-tenant dashboard at `/portal` for signed-in artists (responsive mobile sidebar, EPK editor + PDF print view, streaming analytics, release submission, tour manager, marketing assets, rich-text messages with replies + realtime inbox updates, billing profile management, SOS statement downloads, SOS-linked invoice creation, account settings)
- **Internationalisation (i18n)** – EN/DE support via custom dictionary pattern (`src/i18n/`), locale auto-detected from `Accept-Language` header, locale switcher in Header
- **CRT scanline aesthetic** – immersive dark atmosphere with animated overlays
- **Smooth scrolling** – powered by Lenis
- **Admin panel** – full CMS at `/admin` (CRUD for artists, releases, news, videos, assets; folder-based asset explorer with search/bulk actions; artist asset picker; Artist Auto-Sync; Skeleton loading)
- **Artist Auto-Sync** – "Sync Now" per artist triggers iTunes release import, R2 cover art caching, and Supabase upsert
- **YouTube Sync** – `POST /api/sync-youtube` upserts latest channel videos and links them to visible artists by title match; Vercel cron can trigger daily sync
- **Image proxy** – all images served via wsrv.nl (WebP conversion, on-the-fly resize)
- **Rate limiter** – exponential backoff for all external API calls (`src/lib/rateLimiter.ts`)
- **Authentication** – Supabase Auth with role-based access, protected by Next.js Edge Middleware for `/admin/*` and `/portal/*`
- **Cloud storage** – media uploads via Cloudflare R2 (server-side Route Handler)
- **Server-side rendering** – data fetched at the edge with explicit ISR caching

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| UI framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 (PostCSS) |
| Animations | Framer Motion, Lenis |
| Icons | Phosphor Icons |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth + `@supabase/ssr` + Next.js Edge Middleware |
| Storage | Cloudflare R2 (AWS SDK v3) |
| Deployment | Vercel |
| Testing | Vitest + Testing Library |

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm ci

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local — fill in Supabase URL/key and R2 credentials

# 3. Start development server (http://localhost:3000)
npm run dev
```

> **Admin panel** is available at `http://localhost:3000/admin` once you have authenticated.
> **Artist portal** is available at `http://localhost:3000/portal` (artists sign in with their own Supabase Auth account linked to an artist row).

---

## 📜 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Next.js development server (port 3000) |
| `npm run build` | Production build (`next build`) |
| `npm run preview` | Preview the production build locally (`next start`) |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run Playwright E2E & visual regression tests |
| `npm run analyze` | Build with bundle analyzer enabled |
| `npm run perf:bundle` | Alias for `npm run analyze` |
| `npm run perf:dev` | Start turbo dev server for performance work |
| `npm run perf:build` | Run production profiling build |
| `npm run perf:analyze` | Build with analyzer enabled |
| `npm run perf:lighthouse` | Run Lighthouse CI locally |
| `npm run perf:test` | Run Playwright performance tests |
| `npm run db:push` | Push local Supabase schema changes to a configured Supabase project |
| `npm run db:diff` | Generate a local schema diff with the Supabase CLI |

---

## 📈 Performance Monitoring

- **Lighthouse CI**: `.github/workflows/lighthouse-ci.yml` with budgets in `lighthouserc.js`
- **Web Vitals RUM**: `app/web-vitals.tsx` sends Core Web Vitals to `POST /api/vitals`
- **Bundle analysis**: enabled via `@next/bundle-analyzer` and `npm run analyze`
- **Playwright performance tests**: `tests/performance/core-web-vitals.spec.ts`
- **Bundle budget enforcement**: `scripts/check-bundle-budget.js` + `.github/workflows/performance-budget.yml`

---
## ✅ Quality Assurance

### Local QA commands

```bash
npm run lint
npx tsc --noEmit
npm run test
npm run test:e2e
npm run perf:test
npm run test -- tests/unit/ci-colors.spec.ts
```

### QA CI pipeline

The dedicated QA workflow (`.github/workflows/qa.yml`) runs five jobs:
- `lint-and-unit-tests` — ESLint + Vitest
- `e2e-tests` — Playwright route/security/feature checks
- `security-audit` — npm audit (high severity gate)
- `performance-tests` — Playwright performance assertions
- `ci-validation` — CI color policy enforcement

### Performance budgets

- Homepage LCP target: `< 2500ms` in local/prod-like runs (CI uses relaxed budget)
- Shared `rootMainFiles` bundle budget: `< 500KB` uncompressed

### Security validation procedures

- Verify unauthenticated access is blocked on protected UI routes
- Verify protected API endpoints reject missing/invalid JWTs
- Verify `SUPABASE_SERVICE_ROLE_KEY` is never leaked in browser-rendered HTML
- Verify RLS is enabled for sensitive Supabase tables

---


## 🔑 Environment Variables

Copy `.env.example` to `.env.local` and fill in your values.

### Client-side (`NEXT_PUBLIC_` prefix — exposed to the browser)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |

### Server-side (Next.js Route Handlers / Edge Middleware only — never in the browser)

| Variable | Description |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key — used by `/api/upload` to verify auth tokens |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 API access key ID |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 API secret access key |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 bucket name (e.g. `darktunes-assets`) |
| `CLOUDFLARE_R2_PUBLIC_URL` | R2 public CDN base URL (e.g. `https://cdn.darktunes.com`) |

### External API Keys (optional — Artist Auto-Sync)

| Variable | Description |
|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify app client ID (sync releases by Spotify Artist ID) |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `DISCOGS_TOKEN` | Discogs personal access token (sync releases by Discogs Artist ID) |
| `SONGKICK_API_KEY` | Songkick API key (sync tour dates by Songkick Artist ID) |
| `BANDSINTOWN_API_KEY` | Bandsintown API key (sync tour dates by Bandsintown artist name) |
| `YOUTUBE_API_KEY` | Google API key with YouTube Data API v3 (sync videos via `POST /api/sync-youtube`) |
| `YOUTUBE_CHANNEL_ID` | YouTube channel ID (starts with `UC`) |
| `CRON_SECRET` | Optional secret for Vercel cron requests to `POST /api/sync-youtube` (Bearer token) |
| `CONTACT_EMAIL` | Email address for contact form submissions (defaults to `info@darktunes.com`) |

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for full setup instructions.

---

## 🗄 Database

The schema lives in **`supabase/reset.sql`** — a single fully idempotent script.
Types are defined in `src/types/database.ts`.
**Always keep both in sync** — see the schema change checklist in [AGENTS.md](./AGENTS.md).

To apply the schema (fresh or existing database):
1. Open the **Supabase SQL Editor** in the dashboard.
2. Paste the contents of `supabase/reset.sql` and click **Run**.

The script is safe to re-run at any time — it never deletes existing data.

---

## ♿ Accessibility & Quality

| Requirement | Status | Implementation |
|---|---|---|
| **WCAG 2.1 AA** | ✅ | Skip-to-main link, `lang` attribute, ARIA labels/roles on all interactive elements, decorative images `alt=""` + `aria-hidden`, 44 × 44 px touch targets, visible focus rings |
| **Reduced Motion** | ✅ | `useReducedMotion()` (Framer Motion) in every animated component; transitions and stagger animations are disabled when the OS preference is set |
| **Artist Navigation** | ✅ | All artist cards navigate to `/artists/[slug]` via Next.js `<Link>`. No modal used for artist navigation |
| **TypeScript `any`** | ✅ | Zero `any` annotations in production code; ESLint enforces this |
| **LenisProvider** | ✅ | Single global instance in `app/_components/Providers.tsx`. No `scroll-behavior: smooth` in CSS (Lenis handles it) |
| **Code Splitting** | ✅ | 15 heavy admin manager panels lazy-loaded via `React.lazy` + `Suspense` in `AdminDashboard`. `VideoModal` lazy-loaded in `Videos` (interaction-only) |

---

## 🚀 Deployment

Deployments run on **Vercel** with `"framework": "nextjs"` in `vercel.json`.  
Every push to `main` triggers an automatic production deployment.  
Branch pushes create preview deployments.

The custom install hook `scripts/vercel-install.sh` runs `npm ci` and validates all required environment variables before the build.

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for step-by-step setup.

---

## 📁 Project Structure

```
app/                          # Next.js App Router entry points
├── layout.tsx                # Root RSC layout (fonts, global CSS, Providers)
├── page.tsx                  # Home page RSC — server-side data fetch + ISR caching
├── globals.css               # Global CSS / Tailwind v4 theme
├── _components/              # App-level client wrappers
│   ├── HomePageContent.tsx   # "use client" home page shell (receives data as props)
│   └── Providers.tsx         # Lenis + Toaster + ErrorBoundary (client)
├── admin/                    # Protected admin routes
│   ├── layout.tsx            # Admin route layout
│   ├── page.tsx              # Admin dashboard (force-dynamic, server renders client shell)
│   ├── login/page.tsx        # Login page (force-dynamic)
│   └── _components/          # Client wrappers for admin pages
├── portal/                   # Multi-tenant Artist Portal routes (/portal/*)
│   ├── layout.tsx            # Portal layout (server, renders sidebar)
│   ├── page.tsx              # Dashboard overview (force-dynamic)
│   ├── login/page.tsx        # Artist portal login
│   ├── profile/page.tsx      # EPK profile editor (Server Component + ProfileForm client)
│   ├── analytics/page.tsx    # Streaming analytics (Server Component + StreamingChart client)
│   ├── statements/page.tsx   # Royalty statements (Server Component + StatementsTable client)
│   ├── releases/new/page.tsx # Artist release submission form
│   └── settings/page.tsx     # Account settings (password + locale switch)
└── api/
    ├── upload/route.ts       # Admin upload Route Handler (R2 upload + SHA-256 dedupe + asset row create)
    ├── sync-artist/route.ts  # Artist auto-sync trigger Route Handler
    ├── admin/assets/         # Asset explorer APIs (list/search, folders, batch delete)
    └── portal/
        ├── upload-photo/route.ts         # Portal: profile photo upload to R2
        ├── upload-release-cover/route.ts # Portal: release cover upload to R2
        ├── upload-asset/route.ts         # Portal: artist-owned asset upload/delete
        ├── submit-release/route.ts       # Portal: create release submission (is_visible=false)
        └── profile/route.ts              # Portal: upsert artist EPK profile
middleware.ts                 # Edge Middleware — auth for /admin/* and /portal/*
src/
├── components/               # UI components (Header, Hero, Releases, Artists, …)
│   ├── admin/                # Admin panel + manager components ("use client")
│   │   ├── file-explorer/    # Folder tree, grid/list views, upload dropzone, asset picker
│   │   └── forms/            # Admin CRUD form components
│   ├── animations/           # LenisProvider ("use client")
│   └── ui/                   # Shadcn/Radix primitives
├── contexts/                 # React context providers ("use client")
├── hooks/                    # Custom React hooks (useArtists, useReleases, …)
├── lib/                      # Business logic, API clients, utilities
│   ├── api/                  # Data Access Layer — one file per table
│   │   ├── artistProfiles.ts # EPK profile DAL (artist_profiles table)
│   │   ├── streamingStats.ts # Streaming stats DAL (streaming_stats table)
│   │   ├── salesStatements.ts# Royalty statements DAL (sales_statements table)
│   │   └── artistRowMapper.ts# Shared ArtistRow → Artist domain mapper
│   ├── portal/               # Portal-specific utilities
│   │   └── presignedUrl.ts   # Dependency-injected presigned URL generator
│   ├── sync/                 # Artist sync service (syncArtist.ts)
│   ├── rateLimiter.ts        # HttpError + withExponentialBackoff
│   ├── imageUtils.ts         # wsrv.nl proxy helpers
│   ├── r2Utils.ts            # R2 image upload helper
│   ├── itunesApi.ts          # iTunes Search API client
│   ├── env.server.ts         # Server-side Zod env validation (for Route Handlers)
│   └── supabase/
│       ├── server.ts         # Supabase server client (@supabase/ssr, reads cookies)
│       └── client.ts         # Supabase browser client (@supabase/ssr)
└── types/                    # TypeScript types (incl. database.ts)
supabase/
└── reset.sql                 # Single idempotent SQL script — full schema source of truth
scripts/
└── vercel-install.sh         # Vercel build hook
```

---

## 🎨 Brand Colors

| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#493687` | Violet – CTAs, active nav, focus rings |
| `--secondary` | `#7e1e37` | Pink – hover, promo badges |
| `--background` | `#101010` | Near-black page background |
| `--card` | `#292929` | Cards, modals, player bar |
| `--border` | `#383838` | Subtle borders, inputs |
| `--foreground` | `#ffffff` | Primary text |

---

## 📄 License

Proprietary — All Rights Reserved. See [LICENSE](./LICENSE).


- Press portal: public label press landing, artist EPK pages, embargo-aware press releases, dashboard profile/contact tools, upgraded press kit downloads, and promo-track preview/download flows.
