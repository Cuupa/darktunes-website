-- =============================================================================
-- darkTunes Music Group — Complete Idempotent Database Reset
-- =============================================================================
-- This single script REPLACES all incremental migration files.
-- It is FULLY IDEMPOTENT: safe to run on a fresh database AND on an existing
-- one with live data. Tables are created with IF NOT EXISTS; columns are added
-- with ADD COLUMN IF NOT EXISTS; policies and triggers are always dropped and
-- recreated cleanly.  Existing row data is NEVER deleted.
--
-- Usage: Paste into Supabase Dashboard → SQL Editor → Run
--        (or: supabase db reset --db-url <your-db-url> < supabase/reset.sql)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'editor', 'user', 'journalist');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ensure 'journalist' exists even if the type was created without it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.user_role'::regtype
      AND enumlabel = 'journalist'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'journalist';
  END IF;
END $$;

-- Ensure 'artist' exists (added for the multi-role portal ecosystem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.user_role'::regtype
      AND enumlabel = 'artist'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'artist';
  END IF;
END $$;

DO $$ BEGIN
  CREATE TYPE public.release_type AS ENUM ('album', 'ep', 'single');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sync_status AS ENUM ('success', 'partial', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- HELPER: auto-update updated_at on every row change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- HELPER: auto-create a profile row when a new Auth user registers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Allow the Supabase auth subsystem to call this function
GRANT USAGE  ON SCHEMA public        TO supabase_auth_admin;
GRANT INSERT ON public.profiles      TO supabase_auth_admin;

-- =============================================================================
-- TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: profiles
-- One-to-one extension of auth.users managed by Supabase Auth.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID             PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email      TEXT             NOT NULL,
  role       public.user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill: sync any auth users who registered before this trigger existed
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'user'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- TABLE: artists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.artists (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT        NOT NULL,
  slug             TEXT        NOT NULL UNIQUE,
  bio              TEXT,
  genres           TEXT[]      NOT NULL DEFAULT '{}',
  image_url        TEXT,
  spotify_url      TEXT,
  apple_music_url  TEXT,
  instagram_url    TEXT,
  youtube_url      TEXT,
  website_url      TEXT,
  featured         BOOLEAN     NOT NULL DEFAULT FALSE,
  country          TEXT,
  email            TEXT,
  vat_number       TEXT,
  is_eu_non_german BOOLEAN     NOT NULL DEFAULT FALSE,
  notes            TEXT,
  -- External API sync IDs (Bug 1 fix — were missing from initial schema)
  spotify_id       TEXT,
  discogs_id       TEXT,
  songkick_id      TEXT,
  bandsintown_id   TEXT,
  last_synced_at   TIMESTAMPTZ,
  -- Multi-tenant Artist Portal (Bug 2 fix — was missing from initial schema)
  user_id          UUID        REFERENCES auth.users (id) ON DELETE SET NULL,
  -- Visibility toggle: FALSE hides the artist (and all their releases/concerts) from public
  is_visible       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column additions — no-ops on a fresh DB, safe on existing data
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS spotify_id     TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS discogs_id     TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS songkick_id    TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS bandsintown_id TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS user_id        UUID REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS facebook_url   TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS twitter_url    TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS tiktok_url     TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS bandcamp_url   TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS shop_url       TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS apple_music_url TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS founded_year   SMALLINT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS is_visible     BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_artists_slug     ON public.artists (slug);
CREATE INDEX IF NOT EXISTS idx_artists_featured ON public.artists (featured);
CREATE INDEX IF NOT EXISTS idx_artists_visible  ON public.artists (is_visible);
CREATE UNIQUE INDEX IF NOT EXISTS artists_user_id_key
  ON public.artists (user_id) WHERE user_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_artists_updated_at ON public.artists;
CREATE TRIGGER trg_artists_updated_at
  BEFORE UPDATE ON public.artists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: releases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.releases (
  id              UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT                NOT NULL,
  artist_id       UUID                REFERENCES public.artists (id) ON DELETE CASCADE,
  artist_name     TEXT                NOT NULL,
  release_date    DATE                NOT NULL,
  cover_art       TEXT,
  type            public.release_type NOT NULL,
  spotify_url     TEXT,
  apple_music_url TEXT,
  youtube_url     TEXT,
  featured        BOOLEAN             NOT NULL DEFAULT FALSE,
  itunes_id       TEXT                UNIQUE,
  -- External API sync fields
  spotify_id      TEXT,
  discogs_id      TEXT,
  isrc            TEXT,
  barcode         TEXT,
  catalog_number  TEXT,
  preview_url     TEXT,
  smart_url       TEXT,
  popularity      INTEGER,
  -- Visibility toggle: FALSE hides the release from public
  is_visible      BOOLEAN             NOT NULL DEFAULT TRUE,
  is_promo        BOOLEAN             NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS spotify_id     TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS discogs_id     TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS isrc           TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS barcode        TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS catalog_number TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS preview_url    TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS smart_url      TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS popularity     INTEGER;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS is_visible     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS is_promo       BOOLEAN NOT NULL DEFAULT FALSE;
-- Upgrade FK from SET NULL → CASCADE (idempotent via drop+add)
ALTER TABLE public.releases DROP CONSTRAINT IF EXISTS releases_artist_id_fkey;
ALTER TABLE public.releases ADD CONSTRAINT releases_artist_id_fkey
  FOREIGN KEY (artist_id) REFERENCES public.artists (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_releases_artist_id    ON public.releases (artist_id);
CREATE INDEX IF NOT EXISTS idx_releases_release_date ON public.releases (release_date DESC);
CREATE INDEX IF NOT EXISTS idx_releases_featured     ON public.releases (featured);
CREATE INDEX IF NOT EXISTS idx_releases_itunes_id    ON public.releases (itunes_id);
CREATE INDEX IF NOT EXISTS idx_releases_visible      ON public.releases (is_visible);
CREATE UNIQUE INDEX IF NOT EXISTS releases_spotify_id_key
  ON public.releases (spotify_id) WHERE spotify_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_releases_updated_at ON public.releases;
CREATE TRIGGER trg_releases_updated_at
  BEFORE UPDATE ON public.releases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: news_posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_posts (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT        NOT NULL,
  slug         TEXT        NOT NULL UNIQUE,
  excerpt      TEXT,
  content      TEXT        NOT NULL,
  image_url    TEXT,
  is_press_only BOOLEAN    NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS is_press_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_news_posts_slug         ON public.news_posts (slug);
CREATE INDEX IF NOT EXISTS idx_news_posts_published_at ON public.news_posts (published_at DESC);

DROP TRIGGER IF EXISTS trg_news_posts_updated_at ON public.news_posts;
CREATE TRIGGER trg_news_posts_updated_at
  BEFORE UPDATE ON public.news_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: videos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.videos (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT        NOT NULL,
  artist_name   TEXT        NOT NULL,
  artist_id     UUID        REFERENCES public.artists (id) ON DELETE SET NULL,
  youtube_id    TEXT        NOT NULL UNIQUE,
  thumbnail_url TEXT,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column additions for videos (artist linkage was added after initial deploy)
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS artist_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS artist_id   UUID REFERENCES public.artists (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_videos_youtube_id   ON public.videos (youtube_id);
CREATE INDEX IF NOT EXISTS idx_videos_artist_id    ON public.videos (artist_id);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON public.videos (published_at DESC);

DROP TRIGGER IF EXISTS trg_videos_updated_at ON public.videos;
CREATE TRIGGER trg_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: assets  (Cloudflare R2 metadata registry)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assets (
  id                UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename          TEXT    NOT NULL,
  original_filename TEXT    NOT NULL,
  mime_type         TEXT    NOT NULL,
  size_bytes        BIGINT  NOT NULL,
  r2_key            TEXT    NOT NULL UNIQUE,
  public_url        TEXT    NOT NULL,
  uploaded_by       UUID    REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_uploaded_by ON public.assets (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_assets_mime_type   ON public.assets (mime_type);
CREATE INDEX IF NOT EXISTS idx_assets_created_at  ON public.assets (created_at DESC);

-- ---------------------------------------------------------------------------
-- TABLE: site_settings  (CMS key-value store)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_site_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_site_settings_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: sync_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id               UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id        UUID               REFERENCES public.artists (id) ON DELETE CASCADE,
  status           public.sync_status NOT NULL,
  message          TEXT,
  releases_synced  INTEGER            NOT NULL DEFAULT 0,
  errors           JSONB              NOT NULL DEFAULT '[]',
  api_source       TEXT               NOT NULL DEFAULT 'itunes',
  rate_limited     BOOLEAN            NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS api_source   TEXT    NOT NULL DEFAULT 'itunes';
ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS rate_limited BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_sync_logs_artist_id  ON public.sync_logs (artist_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON public.sync_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- TABLE: concerts  (Songkick / Bandsintown live events)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.concerts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id       UUID        REFERENCES public.artists (id) ON DELETE CASCADE,
  artist_name     TEXT        NOT NULL,
  event_name      TEXT        NOT NULL,
  venue_name      TEXT,
  venue_city      TEXT,
  venue_country   TEXT,
  concert_date    DATE        NOT NULL,
  ticket_url      TEXT,
  songkick_id     TEXT        UNIQUE,
  bandsintown_id  TEXT        UNIQUE,
  status          TEXT        NOT NULL DEFAULT 'ok',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS bandsintown_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_concerts_artist_id    ON public.concerts (artist_id);
CREATE INDEX IF NOT EXISTS idx_concerts_concert_date ON public.concerts (concert_date ASC);

DROP TRIGGER IF EXISTS trg_concerts_updated_at ON public.concerts;
CREATE TRIGGER trg_concerts_updated_at
  BEFORE UPDATE ON public.concerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: newsletter_subscribers  (with Double Opt-In columns)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT        NOT NULL,
  name               TEXT,
  source             TEXT        NOT NULL DEFAULT 'website',
  status             TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'subscribed')),
  verification_token UUID        UNIQUE,
  subscribed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT newsletter_subscribers_email_key UNIQUE (email)
);

ALTER TABLE public.newsletter_subscribers ADD COLUMN IF NOT EXISTS verification_token UUID UNIQUE;
-- Add status as nullable first so existing rows are not rejected
ALTER TABLE public.newsletter_subscribers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
-- Backfill any rows that have a NULL status (e.g. from an earlier schema version)
UPDATE public.newsletter_subscribers SET status = 'subscribed' WHERE status IS NULL;
-- Now enforce NOT NULL + CHECK (no-op if the constraint already exists)
ALTER TABLE public.newsletter_subscribers
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending';
DO $$
BEGIN
  ALTER TABLE public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_status_check
    CHECK (status IN ('pending', 'subscribed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS newsletter_subscribers_email_idx
  ON public.newsletter_subscribers (email);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_token_idx
  ON public.newsletter_subscribers (verification_token);

-- ---------------------------------------------------------------------------
-- TABLE: artist_profiles  (EPK data — artist-managed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.artist_profiles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id      UUID        NOT NULL UNIQUE REFERENCES public.artists (id) ON DELETE CASCADE,
  bio            TEXT,
  bio_short      TEXT,
  bio_medium     TEXT,
  bio_long       TEXT,
  photo_url      TEXT,
  genres         TEXT[]      NOT NULL DEFAULT '{}',
  website_url    TEXT,
  instagram_url  TEXT,
  youtube_url    TEXT,
  bandcamp_url   TEXT,
  press_quote    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS bio_short  TEXT;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS bio_medium TEXT;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS bio_long   TEXT;

CREATE INDEX IF NOT EXISTS idx_artist_profiles_artist_id ON public.artist_profiles (artist_id);

DROP TRIGGER IF EXISTS trg_artist_profiles_updated_at ON public.artist_profiles;
CREATE TRIGGER trg_artist_profiles_updated_at
  BEFORE UPDATE ON public.artist_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: streaming_stats  (monthly platform stream counts per artist)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.streaming_stats (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id   UUID        NOT NULL REFERENCES public.artists (id) ON DELETE CASCADE,
  platform    TEXT        NOT NULL,
  period      TEXT        NOT NULL,
  streams     BIGINT      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (artist_id, platform, period)
);

CREATE INDEX IF NOT EXISTS idx_streaming_stats_artist_id ON public.streaming_stats (artist_id);
CREATE INDEX IF NOT EXISTS idx_streaming_stats_period    ON public.streaming_stats (period DESC);

-- ---------------------------------------------------------------------------
-- TABLE: sales_statements  (royalty PDFs stored in R2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_statements (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id   UUID           NOT NULL REFERENCES public.artists (id) ON DELETE CASCADE,
  filename    TEXT           NOT NULL,
  r2_key      TEXT           NOT NULL UNIQUE,
  period      TEXT           NOT NULL,
  amount_eur  NUMERIC(10, 2),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_statements_artist_id  ON public.sales_statements (artist_id);
CREATE INDEX IF NOT EXISTS idx_sales_statements_created_at ON public.sales_statements (created_at DESC);

-- ---------------------------------------------------------------------------
-- TABLE: release_checklists  (per-artist release task tracking)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.release_checklists (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id     UUID        NOT NULL REFERENCES public.artists (id) ON DELETE CASCADE,
  release_id    UUID        NOT NULL REFERENCES public.releases (id) ON DELETE CASCADE,
  task          TEXT        NOT NULL,
  is_completed  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (artist_id, release_id, task)
);

CREATE INDEX IF NOT EXISTS idx_release_checklists_artist_release
  ON public.release_checklists (artist_id, release_id);

DROP TRIGGER IF EXISTS trg_release_checklists_updated_at ON public.release_checklists;
CREATE TRIGGER trg_release_checklists_updated_at
  BEFORE UPDATE ON public.release_checklists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: press_photos  (public EPK photos stored in R2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.press_photos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT        NOT NULL,
  alt_text       TEXT,
  r2_key         TEXT        NOT NULL UNIQUE,
  public_url     TEXT        NOT NULL,
  display_order  INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_press_photos_display_order
  ON public.press_photos (display_order ASC);

-- ---------------------------------------------------------------------------
-- TABLE: promo_tracks  (journalist-gated unreleased audio — R2 key only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promo_tracks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT        NOT NULL,
  artist_name      TEXT        NOT NULL,
  r2_key           TEXT        NOT NULL UNIQUE,
  file_size_bytes  BIGINT,
  duration_seconds INTEGER,
  display_order    INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_tracks_display_order
  ON public.promo_tracks (display_order ASC);

-- ---------------------------------------------------------------------------
-- TABLE: journalist_applications  (promo-pool access requests)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journalist_applications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES auth.users (id) ON DELETE CASCADE,
  email        TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  outlet       TEXT        NOT NULL,
  message      TEXT,
  status       TEXT        NOT NULL DEFAULT 'pending',
  reviewed_by  UUID        REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT journalist_applications_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_journalist_applications_user_id
  ON public.journalist_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_journalist_applications_status
  ON public.journalist_applications (status);
CREATE INDEX IF NOT EXISTS idx_journalist_applications_created_at
  ON public.journalist_applications (created_at DESC);

-- ---------------------------------------------------------------------------
-- TABLE: portal_feature_flags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_feature_flags (
  id          TEXT        PRIMARY KEY,
  label       TEXT        NOT NULL,
  enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
  target_role TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_feature_flags_target_role
  ON public.portal_feature_flags (target_role);

DROP TRIGGER IF EXISTS trg_portal_feature_flags_updated_at ON public.portal_feature_flags;
CREATE TRIGGER trg_portal_feature_flags_updated_at
  BEFORE UPDATE ON public.portal_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: label_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.label_messages (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID        NOT NULL REFERENCES public.artists (id) ON DELETE CASCADE,
  subject   TEXT        NOT NULL,
  body      TEXT        NOT NULL,
  read      BOOLEAN     NOT NULL DEFAULT FALSE,
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_label_messages_artist_id_sent_at
  ON public.label_messages (artist_id, sent_at DESC);

-- ---------------------------------------------------------------------------
-- TABLE: journalist_downloads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journalist_downloads (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  journalist_id UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  release_id    UUID        REFERENCES public.releases (id) ON DELETE SET NULL,
  asset_key     TEXT        NOT NULL,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journalist_downloads_journalist_id
  ON public.journalist_downloads (journalist_id);
CREATE INDEX IF NOT EXISTS idx_journalist_downloads_downloaded_at
  ON public.journalist_downloads (downloaded_at DESC);

-- ---------------------------------------------------------------------------
-- TABLE: accreditation_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accreditation_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  journalist_id UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_name    TEXT        NOT NULL,
  event_date    DATE        NOT NULL,
  publication   TEXT        NOT NULL,
  reason        TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending',
  admin_note    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT accreditation_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_accreditation_requests_journalist_id
  ON public.accreditation_requests (journalist_id);
CREATE INDEX IF NOT EXISTS idx_accreditation_requests_status
  ON public.accreditation_requests (status);

DROP TRIGGER IF EXISTS trg_accreditation_requests_updated_at ON public.accreditation_requests;
CREATE TRIGGER trg_accreditation_requests_updated_at
  BEFORE UPDATE ON public.accreditation_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artists               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.releases              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_posts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaming_stats       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_statements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_checklists    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.press_photos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_tracks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journalist_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_feature_flags  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journalist_downloads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accreditation_requests ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- HELPER: role lookup — SECURITY DEFINER bypasses RLS when reading profiles,
-- preventing infinite recursion in policies that need to check the caller's role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- RLS: profiles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles: own read"      ON public.profiles;
DROP POLICY IF EXISTS "profiles: own update"    ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin read all" ON public.profiles;

CREATE POLICY "profiles: own read" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles: own update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Uses get_my_role() (SECURITY DEFINER) to avoid infinite recursion that
-- would occur if this policy queried the profiles table directly.
CREATE POLICY "profiles: admin read all" ON public.profiles
  FOR SELECT USING (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: artists
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "artists: public read"         ON public.artists;
DROP POLICY IF EXISTS "artists: public read visible" ON public.artists;
DROP POLICY IF EXISTS "artists: editor+ insert"      ON public.artists;
DROP POLICY IF EXISTS "artists: editor+ update"      ON public.artists;
DROP POLICY IF EXISTS "artists: admin delete"        ON public.artists;
DROP POLICY IF EXISTS "artists: own artist update"   ON public.artists;

-- Anonymous users only see visible artists; admins/editors see all
CREATE POLICY "artists: public read visible" ON public.artists
  FOR SELECT USING (
    is_visible = TRUE
    OR public.get_my_role() IN ('admin', 'editor')
  );

CREATE POLICY "artists: editor+ insert" ON public.artists
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'editor'));

CREATE POLICY "artists: editor+ update" ON public.artists
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'editor'));

CREATE POLICY "artists: admin delete" ON public.artists
  FOR DELETE USING (public.get_my_role() = 'admin');

-- Artists can update their own row via user_id (Artist Portal)
CREATE POLICY "artists: own artist update" ON public.artists
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS: releases
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "releases: public read"         ON public.releases;
DROP POLICY IF EXISTS "releases: public read visible" ON public.releases;
DROP POLICY IF EXISTS "releases: editor+ insert"      ON public.releases;
DROP POLICY IF EXISTS "releases: editor+ update"      ON public.releases;
DROP POLICY IF EXISTS "releases: admin delete"        ON public.releases;

-- Anonymous users only see visible releases whose artist is also visible;
-- admins/editors see all releases regardless of visibility.
CREATE POLICY "releases: public read visible" ON public.releases
  FOR SELECT USING (
    (
      is_visible = TRUE
      AND (
        artist_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.artists a
          WHERE a.id = artist_id AND a.is_visible = TRUE
        )
      )
    )
    OR public.get_my_role() IN ('admin', 'editor')
  );

CREATE POLICY "releases: editor+ insert" ON public.releases
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'editor'));

CREATE POLICY "releases: editor+ update" ON public.releases
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'editor'));

CREATE POLICY "releases: admin delete" ON public.releases
  FOR DELETE USING (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: news_posts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "news_posts: public read"    ON public.news_posts;
DROP POLICY IF EXISTS "news_posts: editor+ insert" ON public.news_posts;
DROP POLICY IF EXISTS "news_posts: editor+ update" ON public.news_posts;
DROP POLICY IF EXISTS "news_posts: admin delete"   ON public.news_posts;

CREATE POLICY "news_posts: public read" ON public.news_posts
  FOR SELECT USING (TRUE);

CREATE POLICY "news_posts: editor+ insert" ON public.news_posts
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'editor'));

CREATE POLICY "news_posts: editor+ update" ON public.news_posts
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'editor'));

CREATE POLICY "news_posts: admin delete" ON public.news_posts
  FOR DELETE USING (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: videos
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "videos: public read"    ON public.videos;
DROP POLICY IF EXISTS "videos: editor+ insert" ON public.videos;
DROP POLICY IF EXISTS "videos: editor+ update" ON public.videos;
DROP POLICY IF EXISTS "videos: admin delete"   ON public.videos;

CREATE POLICY "videos: public read" ON public.videos
  FOR SELECT USING (TRUE);

CREATE POLICY "videos: editor+ insert" ON public.videos
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'editor'));

CREATE POLICY "videos: editor+ update" ON public.videos
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'editor'));

CREATE POLICY "videos: admin delete" ON public.videos
  FOR DELETE USING (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: assets
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "assets: authenticated read" ON public.assets;
DROP POLICY IF EXISTS "assets: editor+ insert"     ON public.assets;
DROP POLICY IF EXISTS "assets: admin delete"       ON public.assets;

CREATE POLICY "assets: authenticated read" ON public.assets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "assets: editor+ insert" ON public.assets
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'editor'));

CREATE POLICY "assets: admin delete" ON public.assets
  FOR DELETE USING (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: site_settings
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "site_settings_public_read"  ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_admin_write"  ON public.site_settings;

CREATE POLICY "site_settings_public_read" ON public.site_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "site_settings_admin_write" ON public.site_settings
  FOR ALL
  USING (public.get_my_role() IN ('admin', 'editor'))
  WITH CHECK (public.get_my_role() IN ('admin', 'editor'));

-- ---------------------------------------------------------------------------
-- RLS: sync_logs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "sync_logs: editor+ read" ON public.sync_logs;

CREATE POLICY "sync_logs: editor+ read" ON public.sync_logs
  FOR SELECT USING (public.get_my_role() IN ('admin', 'editor'));

-- ---------------------------------------------------------------------------
-- RLS: concerts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated reads on concerts" ON public.concerts;
DROP POLICY IF EXISTS "Allow admin inserts on concerts"       ON public.concerts;
DROP POLICY IF EXISTS "Allow admin updates on concerts"       ON public.concerts;
DROP POLICY IF EXISTS "Allow admin deletes on concerts"       ON public.concerts;
DROP POLICY IF EXISTS "concerts: public read visible"         ON public.concerts;
DROP POLICY IF EXISTS "concerts: artist own insert"           ON public.concerts;
DROP POLICY IF EXISTS "concerts: artist own update"           ON public.concerts;
DROP POLICY IF EXISTS "concerts: artist own delete"           ON public.concerts;

-- Anonymous users only see concerts for visible artists; admins/editors see all
CREATE POLICY "concerts: public read visible" ON public.concerts
  FOR SELECT USING (
    artist_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id AND a.is_visible = TRUE
    )
    OR public.get_my_role() IN ('admin', 'editor')
  );

CREATE POLICY "Allow admin inserts on concerts" ON public.concerts
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'editor'));

CREATE POLICY "Allow admin updates on concerts" ON public.concerts
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'editor'));

CREATE POLICY "Allow admin deletes on concerts" ON public.concerts
  FOR DELETE USING (public.get_my_role() IN ('admin', 'editor'));

CREATE POLICY "concerts: artist own insert" ON public.concerts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

CREATE POLICY "concerts: artist own update" ON public.concerts
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()));

CREATE POLICY "concerts: artist own delete" ON public.concerts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- RLS: newsletter_subscribers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "service_role_all" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "anon_insert"      ON public.newsletter_subscribers;

CREATE POLICY "service_role_all" ON public.newsletter_subscribers
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "anon_insert" ON public.newsletter_subscribers
  FOR INSERT TO anon
  WITH CHECK (status = 'pending');

REVOKE ALL ON public.newsletter_subscribers FROM anon;
REVOKE ALL ON public.newsletter_subscribers FROM authenticated;
-- Re-grant INSERT for the anon_insert policy above
GRANT INSERT ON public.newsletter_subscribers TO anon;

-- ---------------------------------------------------------------------------
-- RLS: artist_profiles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "artist_profiles: artist read own"   ON public.artist_profiles;
DROP POLICY IF EXISTS "artist_profiles: artist update own" ON public.artist_profiles;
DROP POLICY IF EXISTS "artist_profiles: admin all"         ON public.artist_profiles;

CREATE POLICY "artist_profiles: artist read own" ON public.artist_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

CREATE POLICY "artist_profiles: artist update own" ON public.artist_profiles
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()));

CREATE POLICY "artist_profiles: admin all" ON public.artist_profiles
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: streaming_stats
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "streaming_stats: artist read own" ON public.streaming_stats;
DROP POLICY IF EXISTS "streaming_stats: admin all"       ON public.streaming_stats;

CREATE POLICY "streaming_stats: artist read own" ON public.streaming_stats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

CREATE POLICY "streaming_stats: admin all" ON public.streaming_stats
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: sales_statements
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "sales_statements: artist read own" ON public.sales_statements;
DROP POLICY IF EXISTS "sales_statements: admin all"       ON public.sales_statements;

CREATE POLICY "sales_statements: artist read own" ON public.sales_statements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

CREATE POLICY "sales_statements: admin all" ON public.sales_statements
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: release_checklists
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "release_checklists: artist read own"   ON public.release_checklists;
DROP POLICY IF EXISTS "release_checklists: artist insert own" ON public.release_checklists;
DROP POLICY IF EXISTS "release_checklists: artist update own" ON public.release_checklists;
DROP POLICY IF EXISTS "release_checklists: admin all"         ON public.release_checklists;

CREATE POLICY "release_checklists: artist read own" ON public.release_checklists
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

CREATE POLICY "release_checklists: artist insert own" ON public.release_checklists
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

CREATE POLICY "release_checklists: artist update own" ON public.release_checklists
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()));

CREATE POLICY "release_checklists: admin all" ON public.release_checklists
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: press_photos
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "press_photos: public read" ON public.press_photos;
DROP POLICY IF EXISTS "press_photos: admin all"   ON public.press_photos;

CREATE POLICY "press_photos: public read" ON public.press_photos
  FOR SELECT USING (TRUE);

CREATE POLICY "press_photos: admin all" ON public.press_photos
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: promo_tracks
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "promo_tracks: journalist read" ON public.promo_tracks;
DROP POLICY IF EXISTS "promo_tracks: admin all"       ON public.promo_tracks;

CREATE POLICY "promo_tracks: journalist read" ON public.promo_tracks
  FOR SELECT USING (public.get_my_role() IN ('journalist', 'admin'));

CREATE POLICY "promo_tracks: admin all" ON public.promo_tracks
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: journalist_applications
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "journalist_applications: own read"    ON public.journalist_applications;
DROP POLICY IF EXISTS "journalist_applications: own insert"  ON public.journalist_applications;
DROP POLICY IF EXISTS "journalist_applications: admin all"   ON public.journalist_applications;

CREATE POLICY "journalist_applications: own read" ON public.journalist_applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "journalist_applications: own insert" ON public.journalist_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "journalist_applications: admin all" ON public.journalist_applications
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: portal_feature_flags
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "portal_feature_flags: authenticated read" ON public.portal_feature_flags;
DROP POLICY IF EXISTS "portal_feature_flags: admin write" ON public.portal_feature_flags;

CREATE POLICY "portal_feature_flags: authenticated read" ON public.portal_feature_flags
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "portal_feature_flags: admin write" ON public.portal_feature_flags
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: label_messages
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "label_messages: artist own read" ON public.label_messages;
DROP POLICY IF EXISTS "label_messages: admin all" ON public.label_messages;

CREATE POLICY "label_messages: artist own read" ON public.label_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

CREATE POLICY "label_messages: admin all" ON public.label_messages
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: journalist_downloads
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "journalist_downloads: own read" ON public.journalist_downloads;
DROP POLICY IF EXISTS "journalist_downloads: own insert" ON public.journalist_downloads;
DROP POLICY IF EXISTS "journalist_downloads: admin read" ON public.journalist_downloads;

CREATE POLICY "journalist_downloads: own read" ON public.journalist_downloads
  FOR SELECT USING (journalist_id = auth.uid());

CREATE POLICY "journalist_downloads: own insert" ON public.journalist_downloads
  FOR INSERT WITH CHECK (journalist_id = auth.uid());

CREATE POLICY "journalist_downloads: admin read" ON public.journalist_downloads
  FOR SELECT USING (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: accreditation_requests
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "accreditation_requests: own read" ON public.accreditation_requests;
DROP POLICY IF EXISTS "accreditation_requests: own insert" ON public.accreditation_requests;
DROP POLICY IF EXISTS "accreditation_requests: admin all" ON public.accreditation_requests;

CREATE POLICY "accreditation_requests: own read" ON public.accreditation_requests
  FOR SELECT USING (journalist_id = auth.uid());

CREATE POLICY "accreditation_requests: own insert" ON public.accreditation_requests
  FOR INSERT WITH CHECK (journalist_id = auth.uid());

CREATE POLICY "accreditation_requests: admin all" ON public.accreditation_requests
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Default CMS site settings
INSERT INTO public.site_settings (key, value) VALUES
  ('label_name',           'darkTunes Music Group'),
  ('label_tagline',        'We don''t follow trends—we create them.'),
  ('contact_email',        'info@darktunes.com'),
  ('privacy_policy_url',   'https://darktunes.com/privacy'),
  ('terms_url',            'https://darktunes.com/terms'),
  ('instagram_url',        'https://instagram.com/darktunes'),
  ('youtube_url',          'https://youtube.com/@darktunes'),
  ('spotify_url',          'https://open.spotify.com/user/darktunes'),
  ('spotify_playlist_uri', '37i9dQZF1DWWqNV5cS50j6'),
  ('hero_badge',           '⚡ New Release'),
  ('hero_description',     'Experience the latest evolution in alternative music. A sonic journey that pushes boundaries and defies expectations.'),
  ('seo_title',            'darkTunes Music Group'),
  ('seo_description',      'Official website for darkTunes Music Group — an alternative music label. Discover artists, releases, news, and videos.'),
  ('og_title',             'darkTunes Music Group'),
  ('og_description',       'Alternative music label — artists, releases, news, and videos.'),
  -- Visual overlay defaults
  ('noise_opacity',         '0.04'),
  ('crt_scanlines_enabled', 'true'),
  ('vignette_intensity',    '0.5')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.portal_feature_flags (id, label, enabled, target_role) VALUES
  ('artist.analytics', 'Artist Analytics', TRUE, 'artist'),
  ('artist.statements', 'Artist Statements', TRUE, 'artist'),
  ('artist.releases', 'Artist Releases', TRUE, 'artist'),
  ('artist.tour', 'Artist Tour', TRUE, 'artist'),
  ('artist.marketing', 'Artist Marketing', TRUE, 'artist'),
  ('artist.messages', 'Artist Messages', TRUE, 'artist'),
  ('journalist.promo_pool', 'Journalist Promo Pool', TRUE, 'journalist'),
  ('journalist.press_kit', 'Journalist Press Kit', TRUE, 'journalist'),
  ('journalist.accreditation', 'Journalist Accreditation', TRUE, 'journalist'),
  ('journalist.press_releases', 'Journalist Press Releases', TRUE, 'journalist'),
  ('journalist.download_history', 'Journalist Download History', TRUE, 'journalist')
ON CONFLICT (id) DO NOTHING;
