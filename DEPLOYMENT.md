# Deployment Guide - darkTunes Music Group

## 🚀 Vercel Deployment

### Prerequisites
1. A Vercel account (https://vercel.com)
2. Vercel CLI installed: `npm i -g vercel`

### Steps to Deploy
1. **Connect to Vercel**
   ```bash
   vercel login
   ```

2. **Link Project** (first time only)
   ```bash
   vercel link
   ```

3. **Set Environment Variables** (in Vercel Dashboard)
   - Go to your project settings
   - Navigate to Environment Variables
   - Add all variables from `.env.example`

4. **Deploy**
   ```bash
   # Preview deployment
   vercel
   
   # Production deployment
   vercel --prod
   ```

### Automatic Deployments
- Push to `main` branch for automatic production deployment
- Push to any branch for automatic preview deployment

---

## 🗄️ Supabase Setup

### 1. Create Supabase Project
1. Go to https://supabase.com
2. Create a new project
3. Note your project URL and anon key

### 2. Database Schema

> ⚠️ **This script is fully idempotent** — it is safe to run on a fresh database
> **and** on an existing one. All tables, policies, triggers and functions are
> dropped and recreated cleanly. **Existing data is preserved** (tables are only
> dropped with `CASCADE` on dependent objects such as policies/triggers, not data).

Run the following SQL in the **Supabase SQL Editor**:

```sql
-- ============================================================
-- IDEMPOTENT SCHEMA SETUP — safe to re-run on existing databases
-- Tables are created fresh; all policies/triggers are replaced.
-- Existing row data is NOT deleted.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- DROP existing triggers, policies and functions so we can
-- recreate them without conflicts. Tables themselves are kept
-- (data is preserved). Use DROP TABLE ... CASCADE only if you
-- intentionally want to wipe all data.
-- ============================================================

-- Drop triggers (ignore errors if they don't exist yet)
DROP TRIGGER IF EXISTS on_auth_user_created        ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at  ON public.profiles;
DROP TRIGGER IF EXISTS update_artists_updated_at   ON public.artists;
DROP TRIGGER IF EXISTS update_releases_updated_at  ON public.releases;
DROP TRIGGER IF EXISTS update_news_posts_updated_at ON public.news_posts;
DROP TRIGGER IF EXISTS update_videos_updated_at    ON public.videos;

-- Drop RLS policies — profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"             ON public.profiles;

-- Drop RLS policies — artists
DROP POLICY IF EXISTS "Artists are viewable by everyone"  ON public.artists;
DROP POLICY IF EXISTS "Only admins can insert artists"    ON public.artists;
DROP POLICY IF EXISTS "Only admins can update artists"    ON public.artists;
DROP POLICY IF EXISTS "Only admins can delete artists"    ON public.artists;

-- Drop RLS policies — releases
DROP POLICY IF EXISTS "Releases are viewable by everyone"  ON public.releases;
DROP POLICY IF EXISTS "Only editors can manage releases"   ON public.releases;

-- Drop RLS policies — news_posts
DROP POLICY IF EXISTS "News are viewable by everyone"  ON public.news_posts;
DROP POLICY IF EXISTS "Only editors can manage news"   ON public.news_posts;

-- Drop RLS policies — videos
DROP POLICY IF EXISTS "Videos are viewable by everyone"  ON public.videos;
DROP POLICY IF EXISTS "Only editors can manage videos"   ON public.videos;

-- Drop RLS policies — assets
DROP POLICY IF EXISTS "Assets are viewable by everyone"  ON public.assets;
DROP POLICY IF EXISTS "Only admins can upload assets"    ON public.assets;

-- ============================================================
-- TABLES  (CREATE IF NOT EXISTS — data is never deleted)
-- ============================================================

-- Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'editor', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artists
CREATE TABLE IF NOT EXISTS public.artists (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  bio             TEXT,
  genres          TEXT[] DEFAULT '{}',
  image_url       TEXT,
  spotify_url     TEXT,
  instagram_url   TEXT,
  youtube_url     TEXT,
  website_url     TEXT,
  featured        BOOLEAN DEFAULT false,
  country         TEXT,
  email           TEXT,
  vat_number      TEXT,
  is_eu_non_german BOOLEAN DEFAULT false,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Releases
CREATE TABLE IF NOT EXISTS public.releases (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  artist_id       UUID REFERENCES public.artists(id) ON DELETE CASCADE,
  artist_name     TEXT NOT NULL,
  release_date    DATE NOT NULL,
  cover_art       TEXT,
  type            TEXT NOT NULL CHECK (type IN ('album', 'ep', 'single')),
  spotify_url     TEXT,
  apple_music_url TEXT,
  youtube_url     TEXT,
  featured        BOOLEAN DEFAULT false,
  itunes_id       TEXT UNIQUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- News posts
CREATE TABLE IF NOT EXISTS public.news_posts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  excerpt      TEXT,
  content      TEXT NOT NULL,
  image_url    TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Videos
CREATE TABLE IF NOT EXISTS public.videos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  artist_name   TEXT NOT NULL,
  youtube_id    TEXT NOT NULL,
  thumbnail_url TEXT,
  published_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Assets (R2 metadata)
CREATE TABLE IF NOT EXISTS public.assets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename          TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  size_bytes        BIGINT NOT NULL,
  r2_key            TEXT NOT NULL UNIQUE,
  public_url        TEXT NOT NULL,
  uploaded_by       UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artists    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.releases   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets     ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Artists
CREATE POLICY "Artists are viewable by everyone" ON public.artists
  FOR SELECT USING (true);

CREATE POLICY "Only admins can insert artists" ON public.artists
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can update artists" ON public.artists
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

CREATE POLICY "Only admins can delete artists" ON public.artists
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Releases
CREATE POLICY "Releases are viewable by everyone" ON public.releases
  FOR SELECT USING (true);

CREATE POLICY "Only editors can manage releases" ON public.releases
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

-- News
CREATE POLICY "News are viewable by everyone" ON public.news_posts
  FOR SELECT USING (true);

CREATE POLICY "Only editors can manage news" ON public.news_posts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

-- Videos
CREATE POLICY "Videos are viewable by everyone" ON public.videos
  FOR SELECT USING (true);

CREATE POLICY "Only editors can manage videos" ON public.videos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

-- Assets
CREATE POLICY "Assets are viewable by everyone" ON public.assets
  FOR SELECT USING (true);

CREATE POLICY "Only admins can upload assets" ON public.assets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- updated_at helper
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_artists_updated_at
  BEFORE UPDATE ON public.artists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_releases_updated_at
  BEFORE UPDATE ON public.releases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_news_posts_updated_at
  BEFORE UPDATE ON public.news_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- Fires on every INSERT into auth.users (every new registration).
-- Without this trigger public.profiles stays empty and
-- admin-promotion SQL will always find 0 rows.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Grant permission so the auth subsystem can call this function
GRANT USAGE  ON SCHEMA public        TO supabase_auth_admin;
GRANT INSERT ON public.profiles      TO supabase_auth_admin;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- BACKFILL: sync any auth users who registered before this
-- trigger existed (safe to run multiple times — ON CONFLICT)
-- ============================================================
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'user'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
```

### 3. Create First Admin User

> **Note:** The script above contains a backfill at the end that automatically
> syncs every existing `auth.users` row into `public.profiles`.
> You can run the entire script on an already-live database without losing data.

#### Step A — Register the user
Sign up through your app's login page or via the Supabase Dashboard:
**Authentication → Users → Invite user**.

#### Step B — Verify the profile row exists
```sql
SELECT id, email, role
FROM public.profiles
WHERE email = 'your-email@example.com';
```
You should see exactly one row. If not, re-run the full schema script above —
the backfill `INSERT … ON CONFLICT DO NOTHING` at the bottom will add it.

#### Step C — Promote to admin
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'your-email@example.com'
  LIMIT 1
);
```
> ⚠️ Replace `your-email@example.com` with the actual address.
> `UPDATE 0 rows` means the profile row is still missing — re-run Step B first.

---

## ☁️ Cloudflare R2 Setup

### 1. Create R2 Bucket
1. Go to Cloudflare Dashboard
2. Navigate to R2 Object Storage
3. Create a new bucket: `darktunes-assets`
4. Enable public access if needed

### 2. Get API Credentials
1. Go to R2 > Manage R2 API Tokens
2. Create API token with read/write permissions
3. Note your Account ID, Access Key ID, and Secret Access Key

### 3. Configure CORS (if needed)
```json
[
  {
    "AllowedOrigins": ["https://your-domain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

### 4. File Uploads via Next.js Route Handler

File uploads are handled server-side at `app/api/upload/route.ts` (a Next.js Route Handler).
This eliminates CORS issues that arise from client-side direct uploads. No Supabase Edge Functions are needed for uploads.

The Route Handler:
1. Verifies the Bearer token via the Supabase service-role key
2. Parses the multipart `FormData` on the server
3. Uploads the file to R2 using the AWS SDK v3
4. Returns the public CDN URL

---

## 🔐 Environment Variables

Set these in your Vercel project settings (Dashboard → Project → Settings → Environment Variables):

### Supabase (client-side — `NEXT_PUBLIC_` prefix, browser-safe)
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL *(required at build time for Next.js)*
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon/public key *(required at build time for Next.js)*

### Supabase (server-side — never exposed to browser)
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service-role key *(server-side only)*
  - Found at: Supabase Dashboard → Project Settings → API → `service_role` key
  - Used by: `app/api/upload/route.ts` (Next.js Route Handler) to verify Bearer auth tokens before accepting R2 uploads

### Cloudflare R2 (server-side — Next.js Route Handlers only)
- `CLOUDFLARE_R2_ACCOUNT_ID`: Your Cloudflare account ID
- `CLOUDFLARE_R2_ACCESS_KEY_ID`: R2 API token access key ID
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`: R2 API token secret access key
- `CLOUDFLARE_R2_BUCKET_NAME`: R2 bucket name (e.g. `darktunes-assets`)
- `CLOUDFLARE_R2_PUBLIC_URL`: R2 public CDN base URL (e.g. `https://cdn.darktunes.com`)

### External API Keys (optional — Artist Auto-Sync)
These are used by `POST /api/sync-artist` to enrich artist profiles. iTunes sync works without any key; the others require keys from the respective developer portals.
- `SPOTIFY_CLIENT_ID`: Spotify app client ID (https://developer.spotify.com/dashboard → Create App)
- `SPOTIFY_CLIENT_SECRET`: Spotify app client secret
- `DISCOGS_TOKEN`: Discogs personal access token (https://www.discogs.com/settings/developers)
- `SONGKICK_API_KEY`: Songkick API key (https://www.songkick.com/developer → Request API key)

### SOS Webhook (optional — Statement of Sales PDF upload from external generator)
- `SOS_WEBHOOK_SECRET`: A random, high-entropy string shared between this app and the SOS PDF generator service. Used to authenticate server-to-server calls to `POST /api/webhooks/sos` and `POST /api/webhooks/sos/confirm`. Generate with `openssl rand -hex 32`.

### Newsletter Double Opt-In (optional — confirmation email delivery)
The following vars are consumed by the **Supabase Edge Function** (`newsletter-confirm`), NOT by the Next.js app. Set them as Edge Function secrets in Supabase Dashboard → Edge Functions → Secrets.
- `RESEND_API_KEY`: API key from https://resend.com — used to send DOI confirmation emails.
- `RESEND_FROM_EMAIL`: Verified sender address, e.g. `noreply@darktunes.com`. Must be a domain verified in Resend.
- `NEXT_PUBLIC_SITE_URL`: The public site URL without trailing slash (e.g. `https://darktunes.com`) — used to build the confirmation link inside the email. Also set this as a Vercel env var (with the `NEXT_PUBLIC_` prefix) so the confirmation page can be rendered.

### Newsletter — MailerLite sync (optional — marketing list)
After DOI confirmation, verified subscribers are pushed to MailerLite server-to-server via `GET /api/newsletter/verify`. Both vars are optional — omit to store subscribers in Supabase only.
- `MAILERLITE_API_KEY`: MailerLite API key from https://app.mailerlite.com/integrations/api/
- `MAILERLITE_GROUP_ID`: MailerLite group/segment ID to add subscribers to.

> ⚠️ **Important for Next.js:** `NEXT_PUBLIC_*` variables must be set in the Vercel project settings for **both** the Production and Preview environments before the first build. Next.js embeds these at compile time. Missing variables will cause the Supabase client to fall back to a placeholder and Supabase features will be disabled at runtime.

---

## 📝 Post-Deployment Checklist

- [ ] Supabase project created and configured
- [ ] Database schema applied (including `handle_new_user` trigger)
- [ ] DOI migration applied (`20260510000001_newsletter_double_opt_in.sql`)
- [ ] Artist portal migration applied (`20260509124000_artist_portal.sql`)
- [ ] First admin user registered **after** schema was applied
- [ ] Admin role confirmed via `SELECT role FROM public.profiles WHERE email = '...'`
- [ ] Artist users registered and linked: `UPDATE artists SET user_id = (SELECT id FROM auth.users WHERE email = 'artist@...') WHERE slug = 'my-artist'`
- [ ] R2 bucket created and configured
- [ ] Environment variables set in Vercel
- [ ] Domain configured in Vercel
- [ ] SSL certificate active
- [ ] Test admin login
- [ ] Test artist portal login at `/portal`
- [ ] Test file upload
- [ ] Test artist "Sync Now" button (iTunes releases import)
- [ ] Check sync_logs table for any errors
- [ ] Test iTunes sync
- [ ] Verify all sections load correctly

---

## 🛠️ Maintenance

### Database Backups
Supabase provides automatic daily backups. Additional backups can be configured in project settings.

### Monitoring
- Check Vercel Analytics for performance metrics
- Monitor Supabase dashboard for database health
- Review R2 usage in Cloudflare dashboard

### Updates
```bash
# Update dependencies
npm update

# Deploy updates
vercel --prod
```
