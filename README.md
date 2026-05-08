# darkTunes Music Group — Website

Official website for **darkTunes Music Group**, an alternative music label.  
Built with React 19, Vite 7, Supabase, Cloudflare R2, and Tailwind CSS v4.

---

## 🎵 Features

- **Public site** – Hero, Releases (iTunes sync), Artists, Videos, News, Spotify Player
- **CRT scanline aesthetic** – immersive dark atmosphere with animated overlays
- **Smooth scrolling** – powered by Lenis
- **Admin panel** – full CMS at `/admin` (CRUD for artists, releases, news, videos, assets)
- **Authentication** – Supabase Auth with role-based access (Admin / Editor / User)
- **Cloud storage** – media uploads via Cloudflare R2

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 19 + TypeScript |
| Build tool | Vite 7 |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion, Lenis |
| Icons | Phosphor Icons |
| Database | Supabase (PostgreSQL) |
| Storage | Cloudflare R2 |
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

# 3. Start development server (http://localhost:5173)
npm run dev
```

> **Admin panel** is available at `http://localhost:5173/admin` once you have authenticated.

---

## 📜 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start local development server |
| `npm run build` | Production build (TypeScript + Vite) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:push` | Push local migrations to Supabase cloud |
| `npm run db:diff` | Diff local schema against remote |

---

## 🔑 Environment Variables

Copy `.env.example` to `.env.local` and fill in your values.

### Client-side (Vite `VITE_` prefix — exposed to the browser)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |

### Server-side (Vercel Edge / Serverless Functions only — never in the browser)

| Variable | Description |
|---|---|
| `CLOUDFLARE_R2_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 API access key ID |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 API secret access key |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 bucket name (e.g. `darktunes-assets`) |
| `CLOUDFLARE_R2_PUBLIC_URL` | R2 public CDN base URL (e.g. `https://cdn.darktunes.com`) |

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

Deployments run on **Vercel**.  
Every push to `main` triggers an automatic production deployment.  
Branch pushes create preview deployments.

The custom install hook `scripts/vercel-install.sh` runs `npm ci` and validates all required environment variables before the build.

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for step-by-step setup.

---

## 📁 Project Structure

```
src/
├── components/        # UI components (Header, Hero, Releases, Artists, …)
│   ├── admin/         # Admin panel components
│   ├── animations/    # LenisProvider and motion helpers
│   └── ui/            # Shadcn/Radix primitives
├── contexts/          # React context providers
├── hooks/             # Custom React hooks
├── lib/               # Business logic, API clients, utilities
├── styles/            # Global CSS / Tailwind configuration
└── types/             # TypeScript types (incl. database.ts)
supabase/
└── migrations/        # SQL migration files (source of truth for schema)
scripts/
└── vercel-install.sh  # Vercel build hook
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
