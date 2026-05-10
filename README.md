# darkTunes Music Group — Website

Official website for **darkTunes Music Group**, an alternative music label.  
Built with **Next.js 15 (App Router)**, React, Supabase, Cloudflare R2, and Tailwind CSS v4.

---

## 🎵 Features

- **Public site** – Hero, Releases (iTunes sync), Artists, Videos, News, Tour dates, Spotify Player
- **Artist Portal** – Secure multi-tenant dashboard at `/portal` for signed-in artists (EPK editor, streaming analytics, royalty statements)
- **Internationalisation (i18n)** – EN/DE support via custom dictionary pattern (`src/i18n/`), locale auto-detected from `Accept-Language` header, locale switcher in Header
- **CRT scanline aesthetic** – immersive dark atmosphere with animated overlays
- **Smooth scrolling** – powered by Lenis
- **Admin panel** – full CMS at `/admin` (CRUD for artists, releases, news, videos, assets; Artist Auto-Sync; Skeleton loading)
- **Artist Auto-Sync** – "Sync Now" per artist triggers iTunes release import, R2 cover art caching, and Supabase upsert
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
| `npm run db:push` | Push local migrations to Supabase cloud |
| `npm run db:diff` | Diff local schema against remote |

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

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for full setup instructions.

---

## 🗄 Database

Migrations live in `supabase/migrations/`.  
Types are auto-derived in `src/types/database.ts`.  
**Always keep both in sync** — see the schema change checklist in [AGENTS.md](./AGENTS.md).

```bash
# Push local migrations to Supabase cloud
npm run db:push

# Diff local schema vs. remote
npm run db:diff
```

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
│   └── statements/page.tsx   # Royalty statements (Server Component + StatementsTable client)
└── api/
    ├── upload/route.ts       # R2 file upload Route Handler (admin)
    ├── sync-artist/route.ts  # Artist auto-sync trigger Route Handler
    └── portal/
        ├── upload-photo/route.ts  # Portal: profile photo upload to R2
        └── profile/route.ts       # Portal: upsert artist EPK profile
middleware.ts                 # Edge Middleware — auth for /admin/* and /portal/*
src/
├── components/               # UI components (Header, Hero, Releases, Artists, …)
│   ├── admin/                # Admin panel + manager components ("use client")
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
└── migrations/               # SQL migration files (source of truth for schema)
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

MIT
