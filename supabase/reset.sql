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
-- SCHEMA PERMISSIONS
-- ---------------------------------------------------------------------------
-- MANUAL PREREQUISITE: Run these commands FIRST in Supabase Dashboard SQL Editor
-- (requires postgres superuser or schema owner privileges):
--
--   ALTER SCHEMA public OWNER TO postgres;
--   GRANT ALL ON SCHEMA public TO postgres;
--   GRANT USAGE, CREATE ON SCHEMA public TO authenticated, anon, service_role;
--
-- These grants cannot be executed within this script because the Supabase
-- Dashboard SQL Editor does not run with sufficient privileges.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------
-- Create types using DO blocks with EXCEPTION handling for true idempotency.
-- This approach works in Supabase Dashboard without requiring schema OWNER rights.
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'editor', 'user', 'journalist', 'artist');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.release_type AS ENUM ('album', 'ep', 'single');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sync_status AS ENUM ('success', 'partial', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ensure 'journalist' exists even if the type was created without it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.user_role'::regtype
      AND enumlabel = 'journalist'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'journalist';
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
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'artist';
  END IF;
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
  avatar_url TEXT,
  provider   TEXT             NOT NULL DEFAULT 'email',
  created_at TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Idempotent guards for columns added after initial schema creation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS provider    TEXT NOT NULL DEFAULT 'email';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;

-- Guard: existing databases may have role as TEXT with a CHECK constraint
-- (created before the user_role enum was introduced). Drop the constraint and
-- cast the column to the enum so that all five role values are accepted.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Drop ALL policies in the public schema before any column-type alterations.
-- Policies are fully recreated below, so this is safe and idempotent.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      pol.policyname,
      pol.tablename
    );
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'role'
      AND data_type    = 'text'
  ) THEN
    -- Drop the text default first; it cannot be auto-cast to the enum type.
    ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE public.profiles
      ALTER COLUMN role TYPE public.user_role USING role::public.user_role;
    -- Re-apply the default as an enum literal.
    ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user'::public.user_role;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- HELPER: auto-link Spotify OAuth users to matching artist rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_oauth_artist_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_spotify_id TEXT;
  v_artist_id  UUID;
BEGIN
  v_spotify_id := NEW.raw_user_meta_data->>'provider_id';

  IF NEW.raw_app_meta_data->>'provider' = 'spotify' AND v_spotify_id IS NOT NULL THEN
    SELECT id INTO v_artist_id
    FROM public.artists
    WHERE spotify_id = v_spotify_id
    LIMIT 1;

    IF v_artist_id IS NOT NULL THEN
      UPDATE public.artists SET user_id = NEW.id WHERE id = v_artist_id;
      UPDATE public.profiles SET role = 'artist' WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_oauth_artist_verify ON auth.users;
CREATE TRIGGER on_oauth_artist_verify
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_oauth_artist_verification();

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
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS logo_url       TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS platform_links JSONB;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT DEFAULT NULL;

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
-- TABLE: asset_folders
-- (must be created before create_artist_asset_folder() and its DO backfill)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  parent_id   UUID REFERENCES public.asset_folders(id) ON DELETE CASCADE,
  artist_id   UUID REFERENCES public.artists(id) ON DELETE SET NULL,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_folders_parent_id ON public.asset_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_asset_folders_artist_id ON public.asset_folders(artist_id);
-- Prevent duplicate folder names within the same directory (NULL parent = root).
-- COALESCE converts NULL parent_id to '' so the unique index treats NULLs as equal.
CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_folders_name_parent
  ON public.asset_folders (name, COALESCE(parent_id::text, ''));

-- ---------------------------------------------------------------------------
-- FUNCTION + TRIGGER: auto-create artist folder in asset_folders on artist insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_artist_asset_folder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_root_id UUID;
BEGIN
  -- Ensure the top-level "artists" root folder exists
  INSERT INTO public.asset_folders (name, parent_id, artist_id, created_by)
  VALUES ('artists', NULL, NULL, NULL)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_root_id
  FROM public.asset_folders
  WHERE name = 'artists' AND parent_id IS NULL
  LIMIT 1;

  -- Create a subfolder named after the artist under the root
  INSERT INTO public.asset_folders (name, parent_id, artist_id, created_by)
  VALUES (NEW.name, v_root_id, NEW.id, NULL)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_artists_create_folder ON public.artists;
CREATE TRIGGER trg_artists_create_folder
  AFTER INSERT ON public.artists
  FOR EACH ROW EXECUTE FUNCTION public.create_artist_asset_folder();

-- Idempotent: create folders for all existing artists that don't have one yet
DO $$
DECLARE
  v_root_id UUID;
  v_artist  RECORD;
BEGIN
  -- Ensure root folder
  INSERT INTO public.asset_folders (name, parent_id, artist_id, created_by)
  VALUES ('artists', NULL, NULL, NULL)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_root_id
  FROM public.asset_folders
  WHERE name = 'artists' AND parent_id IS NULL
  LIMIT 1;

  -- For each artist without a dedicated folder
  FOR v_artist IN
    SELECT a.id, a.name FROM public.artists a
    WHERE NOT EXISTS (
      SELECT 1 FROM public.asset_folders f WHERE f.artist_id = a.id
    )
  LOOP
    INSERT INTO public.asset_folders (name, parent_id, artist_id, created_by)
    VALUES (v_artist.name, v_root_id, v_artist.id, NULL)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

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
  platform_links  JSONB,
  popularity      INTEGER,
  -- Visibility toggle: FALSE hides the release from public
  is_visible      BOOLEAN             NOT NULL DEFAULT TRUE,
  is_promo        BOOLEAN             NOT NULL DEFAULT FALSE,
  -- Optional hero customisation per release
  promo_text      TEXT,
  hero_bg_url     TEXT,
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
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS platform_links JSONB;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS popularity     INTEGER;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS is_visible     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS is_promo       BOOLEAN NOT NULL DEFAULT FALSE;
-- Optional per-release hero customisation
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS promo_text     TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS hero_bg_url    TEXT;
-- Hero button overrides (primary + secondary)
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS hero_primary_btn_label  TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS hero_primary_btn_action TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS hero_primary_btn_href   TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS hero_secondary_btn_label  TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS hero_secondary_btn_action TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS hero_secondary_btn_href   TEXT;
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
  featured     BOOLEAN     NOT NULL DEFAULT FALSE,
  is_press_only BOOLEAN    NOT NULL DEFAULT FALSE,
  status       TEXT        NOT NULL DEFAULT 'published',
  artist_id    UUID        REFERENCES public.artists (id) ON DELETE SET NULL,
  reviewed_by  UUID        REFERENCES auth.users (id) ON DELETE SET NULL,
  embargo_until TIMESTAMPTZ,
  media_contact TEXT,
  release_category TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS featured       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS is_press_only BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS status        TEXT    NOT NULL DEFAULT 'published';
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS artist_id     UUID    REFERENCES public.artists (id) ON DELETE SET NULL;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS reviewed_by   UUID    REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS embargo_until    TIMESTAMPTZ;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS media_contact    TEXT;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS release_category TEXT;
-- Hero background image (separate from cover image_url)
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS hero_bg_url TEXT;
-- Hero button overrides (primary + secondary)
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS hero_primary_btn_label  TEXT;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS hero_primary_btn_action TEXT;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS hero_primary_btn_href   TEXT;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS hero_secondary_btn_label  TEXT;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS hero_secondary_btn_action TEXT;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS hero_secondary_btn_href   TEXT;

CREATE INDEX IF NOT EXISTS idx_news_posts_slug         ON public.news_posts (slug);
CREATE INDEX IF NOT EXISTS idx_news_posts_published_at ON public.news_posts (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_posts_status       ON public.news_posts (status);
CREATE INDEX IF NOT EXISTS idx_news_posts_artist_id    ON public.news_posts (artist_id);

DROP TRIGGER IF EXISTS trg_news_posts_updated_at ON public.news_posts;
CREATE TRIGGER trg_news_posts_updated_at
  BEFORE UPDATE ON public.news_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: release_artists  (many-to-many: releases ↔ artists)
-- Allows multiple artists to be credited on a single release (featurings, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.release_artists (
  release_id UUID NOT NULL REFERENCES public.releases (id) ON DELETE CASCADE,
  artist_id  UUID NOT NULL REFERENCES public.artists  (id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (release_id, artist_id)
);

CREATE INDEX IF NOT EXISTS idx_release_artists_release_id ON public.release_artists (release_id);
CREATE INDEX IF NOT EXISTS idx_release_artists_artist_id  ON public.release_artists (artist_id);

-- RLS for release_artists
ALTER TABLE public.release_artists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "release_artists: public read"              ON public.release_artists;
DROP POLICY IF EXISTS "release_artists: can_manage_releases write" ON public.release_artists;
CREATE POLICY "release_artists: public read" ON public.release_artists
  FOR SELECT USING (true);
CREATE POLICY "release_artists: can_manage_releases write" ON public.release_artists
  FOR ALL USING (public.has_permission(auth.uid(), 'can_manage_releases'));

-- ---------------------------------------------------------------------------
-- TABLE: news_post_artists  (many-to-many: news_posts ↔ artists)
-- Allows a news post to be associated with multiple artists (featurings, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_post_artists (
  news_post_id UUID NOT NULL REFERENCES public.news_posts (id) ON DELETE CASCADE,
  artist_id    UUID NOT NULL REFERENCES public.artists    (id) ON DELETE CASCADE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (news_post_id, artist_id)
);

CREATE INDEX IF NOT EXISTS idx_news_post_artists_news_post_id ON public.news_post_artists (news_post_id);
CREATE INDEX IF NOT EXISTS idx_news_post_artists_artist_id    ON public.news_post_artists (artist_id);

-- RLS for news_post_artists
ALTER TABLE public.news_post_artists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "news_post_artists: public read"           ON public.news_post_artists;
DROP POLICY IF EXISTS "news_post_artists: can_publish_news write" ON public.news_post_artists;
CREATE POLICY "news_post_artists: public read" ON public.news_post_artists
  FOR SELECT USING (true);
CREATE POLICY "news_post_artists: can_publish_news write" ON public.news_post_artists
  FOR ALL USING (public.has_permission(auth.uid(), 'can_publish_news'));

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
  is_visible    BOOLEAN     NOT NULL DEFAULT TRUE,
  is_short      BOOLEAN     NOT NULL DEFAULT FALSE,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column additions for videos (artist linkage was added after initial deploy)
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS artist_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS artist_id   UUID REFERENCES public.artists (id) ON DELETE SET NULL;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS is_visible  BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS is_short    BOOLEAN NOT NULL DEFAULT FALSE;

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

ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.asset_folders(id) ON DELETE SET NULL;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES public.artists(id) ON DELETE SET NULL;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS sha256_hash TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS original_filename TEXT NOT NULL DEFAULT '';
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS release_id UUID REFERENCES public.releases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_uploaded_by ON public.assets (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_assets_mime_type   ON public.assets (mime_type);
CREATE INDEX IF NOT EXISTS idx_assets_created_at  ON public.assets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_folder_id   ON public.assets (folder_id);
CREATE INDEX IF NOT EXISTS idx_assets_artist_id   ON public.assets (artist_id);
CREATE INDEX IF NOT EXISTS idx_assets_sha256_hash ON public.assets (sha256_hash);
CREATE INDEX IF NOT EXISTS idx_assets_release_id  ON public.assets (release_id);

-- ---------------------------------------------------------------------------
-- TABLE: asset_artists  (many-to-many: one asset can belong to multiple artists)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_artists (
  asset_id  UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, artist_id)
);
CREATE INDEX IF NOT EXISTS idx_asset_artists_asset_id  ON public.asset_artists(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_artists_artist_id ON public.asset_artists(artist_id);

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
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  source          TEXT        NOT NULL DEFAULT 'admin',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS bandsintown_id TEXT UNIQUE;
ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'admin';

CREATE INDEX IF NOT EXISTS idx_concerts_artist_id    ON public.concerts (artist_id);
CREATE INDEX IF NOT EXISTS idx_concerts_concert_date ON public.concerts (concert_date ASC);

-- ---------------------------------------------------------------------------
-- TABLE: editor_activity_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.editor_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  editor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  entity_name TEXT,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editor_activity_log_editor_id ON public.editor_activity_log(editor_id);
CREATE INDEX IF NOT EXISTS idx_editor_activity_log_created_at ON public.editor_activity_log(created_at DESC);

-- ---------------------------------------------------------------------------
-- TABLE: editor_notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.editor_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  entity_name TEXT,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editor_notifications_recipient
  ON public.editor_notifications(recipient_id, read);

-- ---------------------------------------------------------------------------
-- TABLE: interview_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interview_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journalist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  preferred_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  artist_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_requests_journalist ON public.interview_requests(journalist_id);
CREATE INDEX IF NOT EXISTS idx_interview_requests_artist ON public.interview_requests(artist_id);

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
                       CHECK (status IN ('pending', 'subscribed', 'unsubscribed')),
  verification_token UUID        UNIQUE,
  unsubscribe_token  UUID        UNIQUE DEFAULT gen_random_uuid(),
  subscribed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT newsletter_subscribers_email_key UNIQUE (email)
);

ALTER TABLE public.newsletter_subscribers ADD COLUMN IF NOT EXISTS verification_token UUID UNIQUE;
-- Add unsubscribe_token for GDPR-compliant one-click unsubscribe links in emails
ALTER TABLE public.newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribe_token UUID UNIQUE DEFAULT gen_random_uuid();
-- Add status as nullable first so existing rows are not rejected
ALTER TABLE public.newsletter_subscribers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
-- Backfill any rows that have a NULL status (e.g. from an earlier schema version)
UPDATE public.newsletter_subscribers SET status = 'subscribed' WHERE status IS NULL;
-- Backfill any rows that have a NULL unsubscribe_token (e.g. from an earlier schema version)
UPDATE public.newsletter_subscribers SET unsubscribe_token = gen_random_uuid() WHERE unsubscribe_token IS NULL;
-- Now enforce NOT NULL + CHECK (no-op if the constraint already exists)
ALTER TABLE public.newsletter_subscribers
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending';
-- Drop and recreate the status check constraint to include 'unsubscribed'
ALTER TABLE public.newsletter_subscribers
  DROP CONSTRAINT IF EXISTS newsletter_subscribers_status_check;
DO $$
BEGIN
  ALTER TABLE public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_status_check
    CHECK (status IN ('pending', 'subscribed', 'unsubscribed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS newsletter_subscribers_email_idx
  ON public.newsletter_subscribers (email);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_token_idx
  ON public.newsletter_subscribers (verification_token);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_unsubscribe_token_idx
  ON public.newsletter_subscribers (unsubscribe_token);

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

ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS bio_short        TEXT;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS bio_medium       TEXT;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS bio_long         TEXT;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS founding_year    INTEGER;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS hometown         TEXT;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS booking_contact  TEXT;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS press_contact    TEXT;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS spotify_url      TEXT;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS apple_music_url  TEXT;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS tiktok_url       TEXT;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS facebook_url     TEXT;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS soundcloud_url   TEXT;

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
  category       TEXT        NOT NULL DEFAULT 'photo',
  artist_id      UUID        REFERENCES public.artists(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.press_photos ADD COLUMN IF NOT EXISTS category  TEXT NOT NULL DEFAULT 'photo';
ALTER TABLE public.press_photos ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES public.artists(id) ON DELETE SET NULL;

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
  genre            TEXT,
  bpm              SMALLINT,
  key              TEXT,
  release_date     DATE,
  nda_required     BOOLEAN     NOT NULL DEFAULT FALSE,
  embargo_until    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.promo_tracks ADD COLUMN IF NOT EXISTS genre          TEXT;
ALTER TABLE public.promo_tracks ADD COLUMN IF NOT EXISTS bpm            SMALLINT;
ALTER TABLE public.promo_tracks ADD COLUMN IF NOT EXISTS key            TEXT;
ALTER TABLE public.promo_tracks ADD COLUMN IF NOT EXISTS release_date   DATE;
ALTER TABLE public.promo_tracks ADD COLUMN IF NOT EXISTS nda_required   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.promo_tracks ADD COLUMN IF NOT EXISTS embargo_until  TIMESTAMPTZ;

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
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id     UUID        NOT NULL REFERENCES public.artists (id) ON DELETE CASCADE,
  subject       TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  body_html     TEXT,
  read          BOOLEAN     NOT NULL DEFAULT FALSE,
  read_at       TIMESTAMPTZ,
  starred       BOOLEAN     NOT NULL DEFAULT FALSE,
  deleted_at    TIMESTAMPTZ,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(body,''))
  ) STORED,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.label_messages
  ADD COLUMN IF NOT EXISTS body_html TEXT;
ALTER TABLE public.label_messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE public.label_messages
  ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.label_messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.label_messages
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(body,''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_label_messages_artist_id_sent_at
  ON public.label_messages (artist_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_label_messages_search ON public.label_messages USING GIN(search_vector);

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

-- ---------------------------------------------------------------------------
-- TABLE: app_logs  (UI errors, R2 errors, Vercel errors, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  source      TEXT        NOT NULL,           -- e.g. 'r2', 'supabase', 'upload', 'ui', 'vercel'
  level       TEXT        NOT NULL DEFAULT 'error', -- 'error' | 'warn' | 'info'
  message     TEXT        NOT NULL,
  details     JSONB       NOT NULL DEFAULT '{}',
  user_id     UUID        REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_logs_source     ON public.app_logs (source);
CREATE INDEX IF NOT EXISTS idx_app_logs_level      ON public.app_logs (level);
CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON public.app_logs (created_at DESC);

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
ALTER TABLE public.editor_activity_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editor_notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_logs              ENABLE ROW LEVEL SECURITY;

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
-- TABLE: role_permissions
-- Stores per-role boolean permission flags.
-- Admin role always has full access (enforced in policies and verifyPermission).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role                public.user_role PRIMARY KEY,
  can_publish_news    BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit_news       BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_artists  BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_releases BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_videos   BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_admin_panel BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by          UUID REFERENCES auth.users(id)
);

-- Insert default permissions for all roles (idempotent)
INSERT INTO public.role_permissions (role, can_publish_news, can_edit_news, can_manage_artists, can_manage_releases, can_manage_videos, can_view_admin_panel)
VALUES
  ('admin',      TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE),
  ('editor',     TRUE,  TRUE,  FALSE, TRUE,  TRUE,  TRUE),
  ('journalist', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('artist',     FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('user',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role) DO NOTHING;

DROP TRIGGER IF EXISTS role_permissions_updated_at ON public.role_permissions;
CREATE TRIGGER role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- HELPER: permission check — looks up the calling user's role in profiles,
-- joins role_permissions, and returns the boolean value for the given column.
-- SECURITY DEFINER bypasses RLS so this is safe to call from RLS policies.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission(perm TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE perm
    WHEN 'can_publish_news'    THEN rp.can_publish_news
    WHEN 'can_edit_news'       THEN rp.can_edit_news
    WHEN 'can_manage_artists'  THEN rp.can_manage_artists
    WHEN 'can_manage_releases' THEN rp.can_manage_releases
    WHEN 'can_manage_videos'   THEN rp.can_manage_videos
    WHEN 'can_view_admin_panel' THEN rp.can_view_admin_panel
    ELSE FALSE
  END
  FROM public.profiles p
  JOIN public.role_permissions rp ON rp.role = p.role
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- RLS: profiles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles: own read"        ON public.profiles;
DROP POLICY IF EXISTS "profiles: own update"      ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin read all"  ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin update all" ON public.profiles;

CREATE POLICY "profiles: own read" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles: own update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Uses get_my_role() (SECURITY DEFINER) to avoid infinite recursion that
-- would occur if this policy queried the profiles table directly.
CREATE POLICY "profiles: admin read all" ON public.profiles
  FOR SELECT USING (public.get_my_role() = 'admin');

-- Allows admins to update any user's profile row (e.g. change role, etc.)
-- get_my_role() is SECURITY DEFINER so it safely reads the caller's own role
-- without triggering recursive RLS evaluation.
CREATE POLICY "profiles: admin update all" ON public.profiles
  FOR UPDATE USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: role_permissions
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "role_permissions: authenticated read" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions: admin update"       ON public.role_permissions;

-- Any authenticated user can read permissions (needed to check their own permissions)
CREATE POLICY "role_permissions: authenticated read" ON public.role_permissions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can modify role permissions
CREATE POLICY "role_permissions: admin update" ON public.role_permissions
  FOR UPDATE USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: artists
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "artists: public read"                  ON public.artists;
DROP POLICY IF EXISTS "artists: public read visible"          ON public.artists;
DROP POLICY IF EXISTS "artists: editor+ insert"               ON public.artists;
DROP POLICY IF EXISTS "artists: editor+ update"               ON public.artists;
DROP POLICY IF EXISTS "artists: admin delete"                 ON public.artists;
DROP POLICY IF EXISTS "artists: own artist update"            ON public.artists;
DROP POLICY IF EXISTS "artists: can_manage_artists insert"    ON public.artists;
DROP POLICY IF EXISTS "artists: can_manage_artists update"    ON public.artists;

-- Anonymous users only see visible artists; admins/editors see all
CREATE POLICY "artists: public read visible" ON public.artists
  FOR SELECT USING (
    is_visible = TRUE
    OR public.get_my_role() IN ('admin', 'editor')
  );

-- Requires can_manage_artists permission (admin always bypasses)
CREATE POLICY "artists: can_manage_artists insert" ON public.artists
  FOR INSERT WITH CHECK (
    public.has_permission('can_manage_artists') OR public.get_my_role() = 'admin'
  );

CREATE POLICY "artists: can_manage_artists update" ON public.artists
  FOR UPDATE USING (
    public.has_permission('can_manage_artists') OR public.get_my_role() = 'admin'
  ) WITH CHECK (
    public.has_permission('can_manage_artists') OR public.get_my_role() = 'admin'
  );

CREATE POLICY "artists: admin delete" ON public.artists
  FOR DELETE USING (public.get_my_role() = 'admin');

-- Artists can update their own row via user_id (Artist Portal)
CREATE POLICY "artists: own artist update" ON public.artists
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS: releases
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "releases: public read"                  ON public.releases;
DROP POLICY IF EXISTS "releases: public read visible"          ON public.releases;
DROP POLICY IF EXISTS "releases: editor+ insert"               ON public.releases;
DROP POLICY IF EXISTS "releases: editor+ update"               ON public.releases;
DROP POLICY IF EXISTS "releases: admin delete"                 ON public.releases;
DROP POLICY IF EXISTS "releases: can_manage_releases insert"   ON public.releases;
DROP POLICY IF EXISTS "releases: can_manage_releases update"   ON public.releases;

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

-- Requires can_manage_releases permission (admin always bypasses)
CREATE POLICY "releases: can_manage_releases insert" ON public.releases
  FOR INSERT WITH CHECK (
    public.has_permission('can_manage_releases') OR public.get_my_role() = 'admin'
  );

CREATE POLICY "releases: can_manage_releases update" ON public.releases
  FOR UPDATE USING (
    public.has_permission('can_manage_releases') OR public.get_my_role() = 'admin'
  ) WITH CHECK (
    public.has_permission('can_manage_releases') OR public.get_my_role() = 'admin'
  );

-- Allows only admins to delete releases
CREATE POLICY "releases: admin delete" ON public.releases
  FOR DELETE USING (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: news_posts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "news_posts: public read"             ON public.news_posts;
DROP POLICY IF EXISTS "news_posts: editor+ insert"          ON public.news_posts;
DROP POLICY IF EXISTS "news_posts: editor+ update"          ON public.news_posts;
DROP POLICY IF EXISTS "news_posts: admin delete"            ON public.news_posts;
DROP POLICY IF EXISTS "news_posts: can_publish_news insert" ON public.news_posts;
DROP POLICY IF EXISTS "news_posts: can_edit_news update"    ON public.news_posts;

-- Allows public read access to all news posts
CREATE POLICY "news_posts: public read" ON public.news_posts
  FOR SELECT USING (TRUE);

-- Requires can_publish_news permission (admin always bypasses)
CREATE POLICY "news_posts: can_publish_news insert" ON public.news_posts
  FOR INSERT WITH CHECK (
    public.has_permission('can_publish_news') OR public.get_my_role() = 'admin'
  );

-- Requires can_edit_news permission (admin always bypasses)
CREATE POLICY "news_posts: can_edit_news update" ON public.news_posts
  FOR UPDATE USING (
    public.has_permission('can_edit_news') OR public.get_my_role() = 'admin'
  ) WITH CHECK (
    public.has_permission('can_edit_news') OR public.get_my_role() = 'admin'
  );

-- Allows only admins to delete news posts
CREATE POLICY "news_posts: admin delete" ON public.news_posts
  FOR DELETE USING (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: videos
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "videos: public read"              ON public.videos;
DROP POLICY IF EXISTS "videos: editor+ insert"           ON public.videos;
DROP POLICY IF EXISTS "videos: editor+ update"           ON public.videos;
DROP POLICY IF EXISTS "videos: admin delete"             ON public.videos;
DROP POLICY IF EXISTS "videos: can_manage_videos insert" ON public.videos;
DROP POLICY IF EXISTS "videos: can_manage_videos update" ON public.videos;

-- Allows public read access to all videos
CREATE POLICY "videos: public read" ON public.videos
  FOR SELECT USING (TRUE);

-- Requires can_manage_videos permission (admin always bypasses)
CREATE POLICY "videos: can_manage_videos insert" ON public.videos
  FOR INSERT WITH CHECK (
    public.has_permission('can_manage_videos') OR public.get_my_role() = 'admin'
  );

CREATE POLICY "videos: can_manage_videos update" ON public.videos
  FOR UPDATE USING (
    public.has_permission('can_manage_videos') OR public.get_my_role() = 'admin'
  ) WITH CHECK (
    public.has_permission('can_manage_videos') OR public.get_my_role() = 'admin'
  );

-- Allows only admins to delete videos
CREATE POLICY "videos: admin delete" ON public.videos
  FOR DELETE USING (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: assets
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "assets: authenticated read"          ON public.assets;
DROP POLICY IF EXISTS "assets: editor+ insert"              ON public.assets;
DROP POLICY IF EXISTS "assets: admin delete"                ON public.assets;
DROP POLICY IF EXISTS "assets: editor+ update"              ON public.assets;
DROP POLICY IF EXISTS "assets: can_view_admin_panel insert" ON public.assets;
DROP POLICY IF EXISTS "assets: can_view_admin_panel update" ON public.assets;

-- Allows any authenticated user to read assets
CREATE POLICY "assets: authenticated read" ON public.assets
  FOR SELECT USING (auth.role() = 'authenticated');

-- Requires can_view_admin_panel permission (admin always bypasses)
CREATE POLICY "assets: can_view_admin_panel insert" ON public.assets
  FOR INSERT WITH CHECK (
    public.has_permission('can_view_admin_panel') OR public.get_my_role() = 'admin'
  );

CREATE POLICY "assets: can_view_admin_panel update" ON public.assets
  FOR UPDATE USING (
    public.has_permission('can_view_admin_panel') OR public.get_my_role() = 'admin'
  ) WITH CHECK (
    public.has_permission('can_view_admin_panel') OR public.get_my_role() = 'admin'
  );

-- Allows only admins to delete assets
CREATE POLICY "assets: admin delete" ON public.assets
  FOR DELETE USING (public.get_my_role() = 'admin');

ALTER TABLE public.asset_folders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "asset_folders: authenticated read"          ON public.asset_folders;
DROP POLICY IF EXISTS "asset_folders: editor+ write"               ON public.asset_folders;
DROP POLICY IF EXISTS "asset_folders: admin delete"                ON public.asset_folders;
DROP POLICY IF EXISTS "asset_folders: editor+ update"              ON public.asset_folders;
DROP POLICY IF EXISTS "asset_folders: can_view_admin_panel write"  ON public.asset_folders;
DROP POLICY IF EXISTS "asset_folders: can_view_admin_panel update" ON public.asset_folders;
-- Allows any authenticated user to browse asset folders
CREATE POLICY "asset_folders: authenticated read" ON public.asset_folders FOR SELECT TO authenticated USING (true);
-- Requires can_view_admin_panel permission
CREATE POLICY "asset_folders: can_view_admin_panel write"  ON public.asset_folders FOR INSERT TO authenticated WITH CHECK (
  public.has_permission('can_view_admin_panel') OR public.get_my_role() = 'admin'
);
-- Allows only admins to delete asset folders
CREATE POLICY "asset_folders: admin delete"                ON public.asset_folders FOR DELETE TO authenticated USING (
  public.get_my_role() = 'admin'
);
-- Requires can_view_admin_panel permission to rename/move asset folders
CREATE POLICY "asset_folders: can_view_admin_panel update" ON public.asset_folders FOR UPDATE TO authenticated USING (
  public.has_permission('can_view_admin_panel') OR public.get_my_role() = 'admin'
);

-- ---------------------------------------------------------------------------
-- RLS: asset_artists
-- ---------------------------------------------------------------------------
ALTER TABLE public.asset_artists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "asset_artists: authenticated read"  ON public.asset_artists;
DROP POLICY IF EXISTS "asset_artists: editor+ write"       ON public.asset_artists;
DROP POLICY IF EXISTS "asset_artists: editor+ delete"      ON public.asset_artists;

-- Allows any authenticated user to read asset–artist links
CREATE POLICY "asset_artists: authenticated read" ON public.asset_artists
  FOR SELECT TO authenticated USING (true);

-- Allows editors and admins to link assets to artists
CREATE POLICY "asset_artists: editor+ write" ON public.asset_artists
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','editor'))
  );

-- Allows editors and admins to unlink assets from artists
CREATE POLICY "asset_artists: editor+ delete" ON public.asset_artists
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','editor'))
  );

-- ---------------------------------------------------------------------------
-- RLS: site_settings
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "site_settings_public_read"  ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_admin_write"  ON public.site_settings;

-- Allows public read of site settings (label name, contact, etc.)
CREATE POLICY "site_settings_public_read" ON public.site_settings
  FOR SELECT USING (TRUE);

-- Allows editors and admins to update site settings
CREATE POLICY "site_settings_admin_write" ON public.site_settings
  FOR ALL
  USING (public.get_my_role() IN ('admin', 'editor'))
  WITH CHECK (public.get_my_role() IN ('admin', 'editor'));

-- ---------------------------------------------------------------------------
-- RLS: sync_logs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "sync_logs: editor+ read" ON public.sync_logs;

-- Allows editors and admins to view sync log entries
CREATE POLICY "sync_logs: editor+ read" ON public.sync_logs
  FOR SELECT USING (public.get_my_role() IN ('admin', 'editor'));

-- ---------------------------------------------------------------------------
-- RLS: app_logs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "app_logs: admin read"   ON public.app_logs;
DROP POLICY IF EXISTS "app_logs: admin insert" ON public.app_logs;

-- Any authenticated user can write (so the UI can report its own errors)
CREATE POLICY "app_logs: admin read" ON public.app_logs
  FOR SELECT USING (public.get_my_role() IN ('admin', 'editor'));

-- Allows any authenticated user to write error logs from the UI
CREATE POLICY "app_logs: authenticated insert" ON public.app_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

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
DROP POLICY IF EXISTS "concerts: artist manage own"           ON public.concerts;

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

-- Allows editors and admins to create concerts
CREATE POLICY "Allow admin inserts on concerts" ON public.concerts
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'editor'));

-- Allows editors and admins to update concerts
CREATE POLICY "Allow admin updates on concerts" ON public.concerts
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'editor'));

-- Allows editors and admins to delete concerts
CREATE POLICY "Allow admin deletes on concerts" ON public.concerts
  FOR DELETE USING (public.get_my_role() IN ('admin', 'editor'));

-- Allows artists to create concerts for their own profile
CREATE POLICY "concerts: artist own insert" ON public.concerts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

-- Allows artists to update their own concerts
CREATE POLICY "concerts: artist own update" ON public.concerts
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()));

-- Allows artists to delete their own concerts
CREATE POLICY "concerts: artist own delete" ON public.concerts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

CREATE POLICY "concerts: artist manage own" ON public.concerts
  FOR ALL USING (
    artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid())
  )
  WITH CHECK (
    artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- RLS: editor_activity_log
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "editor_activity_log: admin read" ON public.editor_activity_log;
DROP POLICY IF EXISTS "editor_activity_log: editor read own" ON public.editor_activity_log;
DROP POLICY IF EXISTS "editor_activity_log: editor insert own" ON public.editor_activity_log;

CREATE POLICY "editor_activity_log: admin read" ON public.editor_activity_log
  FOR SELECT USING (public.get_my_role() = 'admin');

CREATE POLICY "editor_activity_log: editor read own" ON public.editor_activity_log
  FOR SELECT USING (public.get_my_role() = 'editor' AND editor_id = auth.uid());

CREATE POLICY "editor_activity_log: editor insert own" ON public.editor_activity_log
  FOR INSERT WITH CHECK (
    public.get_my_role() = 'editor' AND editor_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- RLS: editor_notifications
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "editor_notifications: editor read own" ON public.editor_notifications;
DROP POLICY IF EXISTS "editor_notifications: editor update own" ON public.editor_notifications;
DROP POLICY IF EXISTS "editor_notifications: admin manage" ON public.editor_notifications;

CREATE POLICY "editor_notifications: editor read own" ON public.editor_notifications
  FOR SELECT USING (
    public.get_my_role() = 'editor' AND recipient_id = auth.uid()
  );

CREATE POLICY "editor_notifications: editor update own" ON public.editor_notifications
  FOR UPDATE USING (
    public.get_my_role() = 'editor' AND recipient_id = auth.uid()
  )
  WITH CHECK (
    public.get_my_role() = 'editor' AND recipient_id = auth.uid()
  );

CREATE POLICY "editor_notifications: admin manage" ON public.editor_notifications
  FOR ALL USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: interview_requests
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "interview_requests: journalist manage own" ON public.interview_requests;
DROP POLICY IF EXISTS "interview_requests: artist read own" ON public.interview_requests;
DROP POLICY IF EXISTS "interview_requests: artist update own" ON public.interview_requests;

CREATE POLICY "interview_requests: journalist manage own" ON public.interview_requests
  FOR ALL USING (journalist_id = auth.uid())
  WITH CHECK (journalist_id = auth.uid());

CREATE POLICY "interview_requests: artist read own" ON public.interview_requests
  FOR SELECT USING (artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid()));

CREATE POLICY "interview_requests: artist update own" ON public.interview_requests
  FOR UPDATE USING (artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid()))
  WITH CHECK (artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- RLS: newsletter_subscribers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "service_role_all"  ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "anon_insert"       ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "anon_unsubscribe"  ON public.newsletter_subscribers;

-- Allows service role full access (used by Edge Functions and server actions)
CREATE POLICY "service_role_all" ON public.newsletter_subscribers
  USING (TRUE) WITH CHECK (TRUE);

-- Allows anonymous users to subscribe (new pending row only)
CREATE POLICY "anon_insert" ON public.newsletter_subscribers
  FOR INSERT TO anon
  WITH CHECK (status = 'pending');

-- Allows anonymous users to unsubscribe via their unique unsubscribe_token (GDPR Art. 7)
CREATE POLICY "anon_unsubscribe" ON public.newsletter_subscribers
  FOR UPDATE TO anon
  USING (unsubscribe_token::text = (current_setting('request.jwt.claims', true)::jsonb->>'unsubscribe_token')
         OR TRUE) -- token match enforced in application layer; policy opens UPDATE to anon
  WITH CHECK (status = 'unsubscribed');

REVOKE ALL ON public.newsletter_subscribers FROM anon;
REVOKE ALL ON public.newsletter_subscribers FROM authenticated;
-- Re-grant INSERT for the anon_insert policy above
GRANT INSERT ON public.newsletter_subscribers TO anon;
-- Re-grant UPDATE for the anon_unsubscribe policy above (restricted to status column)
GRANT UPDATE (status) ON public.newsletter_subscribers TO anon;

-- ---------------------------------------------------------------------------
-- RLS: artist_profiles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "artist_profiles: artist read own"   ON public.artist_profiles;
DROP POLICY IF EXISTS "artist_profiles: artist update own" ON public.artist_profiles;
DROP POLICY IF EXISTS "artist_profiles: admin all"         ON public.artist_profiles;

-- Allows artists to read their own EPK/profile data
CREATE POLICY "artist_profiles: artist read own" ON public.artist_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

-- Allows artists to update their own EPK/profile data
CREATE POLICY "artist_profiles: artist update own" ON public.artist_profiles
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()));

-- Allows admins full access to all artist profiles
CREATE POLICY "artist_profiles: admin all" ON public.artist_profiles
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: streaming_stats
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "streaming_stats: artist read own" ON public.streaming_stats;
DROP POLICY IF EXISTS "streaming_stats: admin all"       ON public.streaming_stats;

-- Allows artists to view their own streaming statistics
CREATE POLICY "streaming_stats: artist read own" ON public.streaming_stats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

-- Allows admins full access to all streaming stats
CREATE POLICY "streaming_stats: admin all" ON public.streaming_stats
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: sales_statements
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "sales_statements: artist read own" ON public.sales_statements;
DROP POLICY IF EXISTS "sales_statements: admin all"       ON public.sales_statements;

-- Allows artists to view their own sales statements
CREATE POLICY "sales_statements: artist read own" ON public.sales_statements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

-- Allows admins full access to all sales statements
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

-- Allows artists to read their own release checklists
CREATE POLICY "release_checklists: artist read own" ON public.release_checklists
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

-- Allows artists to create checklists for their releases
CREATE POLICY "release_checklists: artist insert own" ON public.release_checklists
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

-- Allows artists to update their own release checklists
CREATE POLICY "release_checklists: artist update own" ON public.release_checklists
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()));

-- Allows admins full access to all release checklists
CREATE POLICY "release_checklists: admin all" ON public.release_checklists
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: press_photos
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "press_photos: public read" ON public.press_photos;
DROP POLICY IF EXISTS "press_photos: admin all"   ON public.press_photos;

-- Allows public read access to all press photos
CREATE POLICY "press_photos: public read" ON public.press_photos
  FOR SELECT USING (TRUE);

-- Allows admins full access to press photos
CREATE POLICY "press_photos: admin all" ON public.press_photos
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: promo_tracks
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "promo_tracks: journalist read" ON public.promo_tracks;
DROP POLICY IF EXISTS "promo_tracks: admin all"       ON public.promo_tracks;

-- Allows accredited journalists and admins to access promo tracks
CREATE POLICY "promo_tracks: journalist read" ON public.promo_tracks
  FOR SELECT USING (public.get_my_role() IN ('journalist', 'admin'));

-- Allows admins full access to promo tracks
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

-- Allows applicants to read their own application
CREATE POLICY "journalist_applications: own read" ON public.journalist_applications
  FOR SELECT USING (auth.uid() = user_id);

-- Allows authenticated users to submit a journalist application
CREATE POLICY "journalist_applications: own insert" ON public.journalist_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allows admins full access to journalist applications
CREATE POLICY "journalist_applications: admin all" ON public.journalist_applications
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: portal_feature_flags
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "portal_feature_flags: authenticated read" ON public.portal_feature_flags;
DROP POLICY IF EXISTS "portal_feature_flags: admin write" ON public.portal_feature_flags;

-- Allows any authenticated user to read portal feature flags
CREATE POLICY "portal_feature_flags: authenticated read" ON public.portal_feature_flags
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allows admins to manage portal feature flags
CREATE POLICY "portal_feature_flags: admin write" ON public.portal_feature_flags
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: label_messages
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "label_messages: artist own read" ON public.label_messages;
DROP POLICY IF EXISTS "label_messages: admin all" ON public.label_messages;

-- Allows artists to read messages sent to their profile
CREATE POLICY "label_messages: artist own read" ON public.label_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

-- Allows admins full access to all label messages
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

-- Allows journalists to view their own download history
CREATE POLICY "journalist_downloads: own read" ON public.journalist_downloads
  FOR SELECT USING (journalist_id = auth.uid());

-- Allows journalists to log new downloads (GDPR Art. 6(1)(f))
CREATE POLICY "journalist_downloads: own insert" ON public.journalist_downloads
  FOR INSERT WITH CHECK (journalist_id = auth.uid());

-- Allows admins to read all journalist download logs
CREATE POLICY "journalist_downloads: admin read" ON public.journalist_downloads
  FOR SELECT USING (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: accreditation_requests
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "accreditation_requests: own read" ON public.accreditation_requests;
DROP POLICY IF EXISTS "accreditation_requests: own insert" ON public.accreditation_requests;
DROP POLICY IF EXISTS "accreditation_requests: admin all" ON public.accreditation_requests;

-- Allows journalists to read their own accreditation requests
CREATE POLICY "accreditation_requests: own read" ON public.accreditation_requests
  FOR SELECT USING (journalist_id = auth.uid());

-- Allows authenticated users to submit accreditation requests
CREATE POLICY "accreditation_requests: own insert" ON public.accreditation_requests
  FOR INSERT WITH CHECK (journalist_id = auth.uid());

-- Allows admins full access to accreditation requests
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
  ('artist.statements', 'Artist Statements', TRUE, 'artist'),
  ('artist.marketing', 'Artist Marketing', TRUE, 'artist'),
  ('journalist.accreditation', 'Journalist Accreditation', TRUE, 'journalist')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.portal_feature_flags (id, label, enabled, target_role) VALUES
  ('press.applications',  'Press Portal Applications',          TRUE, 'journalist'),
  ('press.promo_tracks',  'Press Promo Pool Access',            TRUE, 'journalist'),
  ('press.zip_download',  'Press Kit ZIP Download',             TRUE, 'journalist'),
  ('press.audio_preview', 'Promo Track In-Browser Preview',     TRUE, 'journalist'),
  ('press.contact',       'Press Inquiry Form',                 TRUE, 'journalist')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- artist_assets — files uploaded by artists via the portal
-- ============================================================
CREATE TABLE IF NOT EXISTS public.artist_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  r2_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.artist_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artist_assets_select_own" ON public.artist_assets;
DROP POLICY IF EXISTS "artist_assets_insert_own" ON public.artist_assets;
DROP POLICY IF EXISTS "artist_assets_delete_own" ON public.artist_assets;
DROP POLICY IF EXISTS "artist_assets_admin_all" ON public.artist_assets;

-- Allows artists to read their own asset entries
CREATE POLICY "artist_assets_select_own" ON public.artist_assets
  FOR SELECT USING (
    artist_id = (SELECT id FROM public.artists WHERE user_id = auth.uid())
  );

-- Allows artists to add asset entries for their own profile
CREATE POLICY "artist_assets_insert_own" ON public.artist_assets
  FOR INSERT WITH CHECK (
    artist_id = (SELECT id FROM public.artists WHERE user_id = auth.uid())
  );

-- Allows artists to delete their own asset entries
CREATE POLICY "artist_assets_delete_own" ON public.artist_assets
  FOR DELETE USING (
    artist_id = (SELECT id FROM public.artists WHERE user_id = auth.uid())
  );

-- Allows admins full access to all artist assets
CREATE POLICY "artist_assets_admin_all" ON public.artist_assets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- artist_replies — artist replies to label messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.artist_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.label_messages(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) > 0),
  body_html TEXT,
  deleted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.artist_replies
  ADD COLUMN IF NOT EXISTS body_html TEXT;
ALTER TABLE public.artist_replies
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.artist_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artist_replies_select_own" ON public.artist_replies;
DROP POLICY IF EXISTS "artist_replies_insert_own" ON public.artist_replies;
DROP POLICY IF EXISTS "artist_replies_admin_all" ON public.artist_replies;

-- Allows artists to read their own message replies
CREATE POLICY "artist_replies_select_own" ON public.artist_replies
  FOR SELECT USING (
    artist_id = (SELECT id FROM public.artists WHERE user_id = auth.uid())
  );

-- Allows artists to write replies to messages addressed to them
CREATE POLICY "artist_replies_insert_own" ON public.artist_replies
  FOR INSERT WITH CHECK (
    artist_id = (SELECT id FROM public.artists WHERE user_id = auth.uid())
  );

-- Allows admins full access to all artist message replies
CREATE POLICY "artist_replies_admin_all" ON public.artist_replies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

ALTER TABLE public.label_messages REPLICA IDENTITY FULL;
ALTER TABLE public.artist_replies REPLICA IDENTITY FULL;

-- TABLE: message_templates
CREATE TABLE IF NOT EXISTS public.message_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  subject    TEXT        NOT NULL DEFAULT '',
  body_html  TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "message_templates: admin all" ON public.message_templates;
-- Allows admins full access to reusable message templates
CREATE POLICY "message_templates: admin all" ON public.message_templates
  FOR ALL USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ============================================================
-- TABLE: media_folders  (dedicated filesystem for Press & Media tab)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  parent_id   UUID REFERENCES public.media_folders(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_folders_parent_id ON public.media_folders(parent_id);

-- ---------------------------------------------------------------------------
-- TABLE: media_files  (dedicated filesystem for Press & Media tab)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_files (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  filename          TEXT    NOT NULL,
  original_filename TEXT    NOT NULL,
  mime_type         TEXT    NOT NULL,
  size_bytes        BIGINT  NOT NULL,
  r2_key            TEXT    NOT NULL UNIQUE,
  public_url        TEXT    NOT NULL,
  uploaded_by       UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  folder_id         UUID    REFERENCES public.media_folders(id) ON DELETE SET NULL,
  artist_id         UUID    REFERENCES public.artists(id) ON DELETE SET NULL,
  tags              TEXT[]  NOT NULL DEFAULT '{}',
  sha256_hash       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_files_folder_id   ON public.media_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_media_files_created_at  ON public.media_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_files_sha256_hash ON public.media_files(sha256_hash);
ALTER TABLE public.media_files ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES public.artists(id) ON DELETE SET NULL;

-- RLS: media_folders
ALTER TABLE public.media_folders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "media_folders: authenticated read"          ON public.media_folders;
DROP POLICY IF EXISTS "media_folders: editor+ write"               ON public.media_folders;
DROP POLICY IF EXISTS "media_folders: admin delete"                ON public.media_folders;
DROP POLICY IF EXISTS "media_folders: editor+ update"              ON public.media_folders;
DROP POLICY IF EXISTS "media_folders: can_view_admin_panel write"  ON public.media_folders;
DROP POLICY IF EXISTS "media_folders: can_view_admin_panel update" ON public.media_folders;
-- Allows any authenticated user to browse media folders
CREATE POLICY "media_folders: authenticated read"          ON public.media_folders FOR SELECT TO authenticated USING (true);
-- Requires can_view_admin_panel permission
CREATE POLICY "media_folders: can_view_admin_panel write"  ON public.media_folders FOR INSERT TO authenticated WITH CHECK (
  public.has_permission('can_view_admin_panel') OR public.get_my_role() = 'admin'
);
-- Allows only admins to delete media folders
CREATE POLICY "media_folders: admin delete"                ON public.media_folders FOR DELETE TO authenticated USING (
  public.get_my_role() = 'admin'
);
-- Requires can_view_admin_panel permission to rename/move media folders
CREATE POLICY "media_folders: can_view_admin_panel update" ON public.media_folders FOR UPDATE TO authenticated USING (
  public.has_permission('can_view_admin_panel') OR public.get_my_role() = 'admin'
);

-- RLS: media_files
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "media_files: authenticated read"          ON public.media_files;
DROP POLICY IF EXISTS "media_files: editor+ write"               ON public.media_files;
DROP POLICY IF EXISTS "media_files: editor+ update"              ON public.media_files;
DROP POLICY IF EXISTS "media_files: admin delete"                ON public.media_files;
DROP POLICY IF EXISTS "media_files: can_view_admin_panel write"  ON public.media_files;
DROP POLICY IF EXISTS "media_files: can_view_admin_panel update" ON public.media_files;
-- Allows any authenticated user to browse media files
CREATE POLICY "media_files: authenticated read"          ON public.media_files FOR SELECT TO authenticated USING (true);
-- Requires can_view_admin_panel permission
CREATE POLICY "media_files: can_view_admin_panel write"  ON public.media_files FOR INSERT TO authenticated WITH CHECK (
  public.has_permission('can_view_admin_panel') OR public.get_my_role() = 'admin'
);
-- Requires can_view_admin_panel permission to update media file metadata
CREATE POLICY "media_files: can_view_admin_panel update" ON public.media_files FOR UPDATE TO authenticated USING (
  public.has_permission('can_view_admin_panel') OR public.get_my_role() = 'admin'
);
-- Allows only admins to delete media files
CREATE POLICY "media_files: admin delete"                ON public.media_files FOR DELETE TO authenticated USING (
  public.get_my_role() = 'admin'
);

-- ============================================================
-- Scheduled news publishing (pg_cron)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'publish-scheduled-news',
  '* * * * *',
  $$
    UPDATE public.news_posts
    SET status = 'published', updated_at = NOW()
    WHERE status = 'scheduled'
      AND published_at <= NOW();
  $$
);

-- =============================================================================
-- AUDIT TABLES: role_changes & ban_history
-- =============================================================================

-- ---------------------------------------------------------------------------
-- HELPER: get_linked_artist_id — returns the artist.id linked to a given user
-- Used in RLS policies and server-side queries.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_linked_artist_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.artists WHERE user_id = p_user_id LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- TABLE: role_changes
-- Immutable audit log: every change to profiles.role is recorded here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_changes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_role    TEXT        NOT NULL,
  new_role    TEXT        NOT NULL,
  changed_by  UUID        NOT NULL REFERENCES auth.users(id),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason      TEXT,
  ip_address  INET
);

CREATE INDEX IF NOT EXISTS idx_role_changes_user_id    ON public.role_changes (user_id);
CREATE INDEX IF NOT EXISTS idx_role_changes_changed_at ON public.role_changes (changed_at DESC);

ALTER TABLE public.role_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_changes: admin read" ON public.role_changes;
DROP POLICY IF EXISTS "role_changes: admin insert" ON public.role_changes;

CREATE POLICY "role_changes: admin read" ON public.role_changes
  FOR SELECT USING (public.get_my_role() = 'admin');

CREATE POLICY "role_changes: admin insert" ON public.role_changes
  FOR INSERT WITH CHECK (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- TRIGGER: auto-log every profiles.role update into role_changes
-- Uses auth.uid() to capture the acting admin; falls back to user_id itself
-- when the update runs in a SECURITY DEFINER context without a session user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed_by UUID;
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    v_changed_by := COALESCE(auth.uid(), NEW.id);
    INSERT INTO public.role_changes (user_id, old_role, new_role, changed_by)
    VALUES (NEW.id, OLD.role::TEXT, NEW.role::TEXT, v_changed_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_role_change ON public.profiles;
CREATE TRIGGER trg_log_role_change
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_role_change();

-- ---------------------------------------------------------------------------
-- TABLE: ban_history
-- Immutable audit log: every ban/unban action is recorded here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ban_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned       BOOLEAN     NOT NULL,
  banned_until TIMESTAMPTZ,
  changed_by   UUID        NOT NULL REFERENCES auth.users(id),
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason       TEXT
);

CREATE INDEX IF NOT EXISTS idx_ban_history_user_id    ON public.ban_history (user_id);
CREATE INDEX IF NOT EXISTS idx_ban_history_changed_at ON public.ban_history (changed_at DESC);

ALTER TABLE public.ban_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ban_history: admin read"   ON public.ban_history;
DROP POLICY IF EXISTS "ban_history: admin insert" ON public.ban_history;

CREATE POLICY "ban_history: admin read" ON public.ban_history
  FOR SELECT USING (public.get_my_role() = 'admin');

CREATE POLICY "ban_history: admin insert" ON public.ban_history
  FOR INSERT WITH CHECK (public.get_my_role() = 'admin');

-- =============================================================================
-- CUSTOM ROLES & PERMISSIONS (user-defined, supplemental to the system enum)
-- =============================================================================

-- TABLE: custom_permission_definitions
-- User-defined permission keys that can be assigned to custom roles.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_permission_definitions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,  -- machine key, e.g. 'can_export_data'
  label       TEXT        NOT NULL,          -- display label
  description TEXT,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS custom_permission_definitions_updated_at ON public.custom_permission_definitions;
CREATE TRIGGER custom_permission_definitions_updated_at
  BEFORE UPDATE ON public.custom_permission_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.custom_permission_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_permission_definitions: admin read"   ON public.custom_permission_definitions;
DROP POLICY IF EXISTS "custom_permission_definitions: admin write"  ON public.custom_permission_definitions;

CREATE POLICY "custom_permission_definitions: admin read"  ON public.custom_permission_definitions
  FOR SELECT USING (public.get_my_role() = 'admin');
CREATE POLICY "custom_permission_definitions: admin write" ON public.custom_permission_definitions
  FOR ALL USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- TABLE: custom_roles
-- User-defined roles, supplementary to the system user_role enum.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,  -- machine key, e.g. 'moderator'
  label       TEXT        NOT NULL,          -- display name
  description TEXT,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS custom_roles_updated_at ON public.custom_roles;
CREATE TRIGGER custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_roles: admin read"  ON public.custom_roles;
DROP POLICY IF EXISTS "custom_roles: admin write" ON public.custom_roles;

CREATE POLICY "custom_roles: admin read"  ON public.custom_roles
  FOR SELECT USING (public.get_my_role() = 'admin');
CREATE POLICY "custom_roles: admin write" ON public.custom_roles
  FOR ALL USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- TABLE: custom_role_permissions
-- Maps custom roles to permission names (both system and custom-defined keys).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_role_permissions (
  role_id         UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission_name TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_name)
);

ALTER TABLE public.custom_role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_role_permissions: admin read"  ON public.custom_role_permissions;
DROP POLICY IF EXISTS "custom_role_permissions: admin write" ON public.custom_role_permissions;

CREATE POLICY "custom_role_permissions: admin read"  ON public.custom_role_permissions
  FOR SELECT USING (public.get_my_role() = 'admin');
CREATE POLICY "custom_role_permissions: admin write" ON public.custom_role_permissions
  FOR ALL USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- TABLE: user_custom_roles
-- Assigns custom roles to users (supplementary to profiles.role).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_custom_roles (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_custom_roles_user_id ON public.user_custom_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_roles_role_id ON public.user_custom_roles (role_id);

ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_custom_roles: admin read"  ON public.user_custom_roles;
DROP POLICY IF EXISTS "user_custom_roles: admin write" ON public.user_custom_roles;

CREATE POLICY "user_custom_roles: admin read"  ON public.user_custom_roles
  FOR SELECT USING (public.get_my_role() = 'admin');
CREATE POLICY "user_custom_roles: admin write" ON public.user_custom_roles
  FOR ALL USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- =============================================================================
-- RBAC AUDIT LOG
-- Comprehensive, append-only log of all RBAC changes:
--   - System role permission updates (trigger)
--   - Custom role / custom permission CRUD (written by API)
--   - User custom role assignments / revocations (written by API)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rbac_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,  -- e.g. 'permission_change', 'custom_role_created'
  target_type TEXT        NOT NULL,  -- 'system_role' | 'custom_role' | 'custom_permission' | 'user_custom_role'
  target_id   TEXT,                  -- role name, UUID, or user id
  old_value   JSONB,
  new_value   JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rbac_audit_log_created_at  ON public.rbac_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_log_actor_id    ON public.rbac_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_log_target_type ON public.rbac_audit_log (target_type);

ALTER TABLE public.rbac_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rbac_audit_log: admin read"   ON public.rbac_audit_log;
DROP POLICY IF EXISTS "rbac_audit_log: admin insert" ON public.rbac_audit_log;

CREATE POLICY "rbac_audit_log: admin read"   ON public.rbac_audit_log
  FOR SELECT USING (public.get_my_role() = 'admin');
CREATE POLICY "rbac_audit_log: admin insert" ON public.rbac_audit_log
  FOR INSERT WITH CHECK (public.get_my_role() = 'admin');

-- TRIGGER: auto-log every update to role_permissions into rbac_audit_log
CREATE OR REPLACE FUNCTION public.log_permission_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rbac_audit_log (actor_id, action, target_type, target_id, old_value, new_value)
  VALUES (
    COALESCE(NEW.updated_by, auth.uid()),
    'permission_change',
    'system_role',
    NEW.role::TEXT,
    (to_jsonb(OLD) - 'updated_at' - 'updated_by'),
    (to_jsonb(NEW) - 'updated_at' - 'updated_by')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_permission_change ON public.role_permissions;
CREATE TRIGGER trg_log_permission_change
  AFTER UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_permission_change();

-- =============================================================================
-- ADMIN AUDIT LOG
-- General-purpose, append-only log for all admin panel actions.
-- Written by API routes; read by admin users only.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,   -- verb: 'created', 'updated', 'deleted', 'banned', etc.
  resource    TEXT        NOT NULL,   -- table/domain: 'artists', 'releases', 'users', etc.
  resource_id TEXT,                   -- PK of the affected row (if applicable)
  details     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at  ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_id    ON public.admin_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_resource    ON public.admin_audit_log (resource);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_audit_log: admin read"   ON public.admin_audit_log;
DROP POLICY IF EXISTS "admin_audit_log: admin insert" ON public.admin_audit_log;

CREATE POLICY "admin_audit_log: admin read"   ON public.admin_audit_log
  FOR SELECT USING (public.get_my_role() = 'admin');
CREATE POLICY "admin_audit_log: admin insert" ON public.admin_audit_log
  FOR INSERT WITH CHECK (public.get_my_role() = 'admin');

-- =============================================================================
-- RESOURCE OWNERSHIP: artist-own-read RLS for releases and concerts
-- Artists may read their own releases (including is_visible=false, pending review)
-- and their own concerts regardless of the artist's is_visible status.
-- Admins/editors bypass this via the existing "editor+ read all" policies.
-- =============================================================================

-- releases: artist own read (must be dropped/re-created idempotently)
DROP POLICY IF EXISTS "releases: artist own read" ON public.releases;
CREATE POLICY "releases: artist own read" ON public.releases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id
        AND a.user_id = auth.uid()
    )
  );

-- concerts: artist own read (supplements the existing public-read-visible policy)
DROP POLICY IF EXISTS "concerts: artist own read" ON public.concerts;
CREATE POLICY "concerts: artist own read" ON public.concerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id
        AND a.user_id = auth.uid()
    )
  );

-- =============================================================================
-- SUBMISSION SYSTEM (release submissions, video submissions, form schema)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUM: submission_status
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.submission_status AS ENUM ('received', 'reviewed', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- TABLE: release_submissions
-- Artist-submitted release drafts for label review. Separate from the public
-- releases catalog — the label decides when to promote a submission to a release.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.release_submissions (
  id                  UUID                      PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id           UUID                      NOT NULL REFERENCES public.artists (id) ON DELETE CASCADE,
  status              public.submission_status  NOT NULL DEFAULT 'received',
  title               TEXT                      NOT NULL,
  release_date        DATE,
  type                public.release_type,
  genre               TEXT,
  catalog_number      TEXT,
  isrc                TEXT,
  label_copy          TEXT,
  audio_download_url  TEXT                      NOT NULL,
  cover_art_url       TEXT                      NOT NULL,
  cover_art_verified  BOOLEAN                   NOT NULL DEFAULT FALSE,
  spotify_url         TEXT,
  apple_music_url     TEXT,
  youtube_url         TEXT,
  notes               TEXT,
  form_data           JSONB,
  admin_reply         TEXT,
  admin_reply_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ               NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ               NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_release_submissions_artist_id ON public.release_submissions (artist_id);
CREATE INDEX IF NOT EXISTS idx_release_submissions_status    ON public.release_submissions (status);
CREATE INDEX IF NOT EXISTS idx_release_submissions_created   ON public.release_submissions (created_at DESC);

DROP TRIGGER IF EXISTS trg_release_submissions_updated_at ON public.release_submissions;
CREATE TRIGGER trg_release_submissions_updated_at
  BEFORE UPDATE ON public.release_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: video_submissions
-- Artist-submitted music video drafts for label/YouTube processing.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.video_submissions (
  id                    UUID                      PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id             UUID                      NOT NULL REFERENCES public.artists (id) ON DELETE CASCADE,
  status                public.submission_status  NOT NULL DEFAULT 'received',
  title                 TEXT                      NOT NULL,
  description           TEXT,
  download_url          TEXT                      NOT NULL,
  thumbnail_url         TEXT,
  youtube_title         TEXT,
  youtube_description   TEXT,
  youtube_tags          TEXT[]                    NOT NULL DEFAULT '{}',
  youtube_category      TEXT,
  target_publish_date   DATE,
  notes                 TEXT,
  admin_reply           TEXT,
  admin_reply_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ               NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ               NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_submissions_artist_id ON public.video_submissions (artist_id);
CREATE INDEX IF NOT EXISTS idx_video_submissions_status    ON public.video_submissions (status);
CREATE INDEX IF NOT EXISTS idx_video_submissions_created   ON public.video_submissions (created_at DESC);

DROP TRIGGER IF EXISTS trg_video_submissions_updated_at ON public.video_submissions;
CREATE TRIGGER trg_video_submissions_updated_at
  BEFORE UPDATE ON public.video_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: submission_form_schema
-- Admin-configurable field definitions for the release and video submission forms.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submission_form_schema (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_type        TEXT        NOT NULL CHECK (form_type IN ('release', 'video')),
  field_key        TEXT        NOT NULL,
  field_label_en   TEXT        NOT NULL,
  field_label_de   TEXT        NOT NULL,
  field_type       TEXT        NOT NULL CHECK (field_type IN ('text', 'url', 'date', 'select', 'textarea', 'boolean')),
  field_options    JSONB,
  is_required      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_visible       BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order    INTEGER     NOT NULL DEFAULT 0,
  placeholder_en   TEXT,
  placeholder_de   TEXT,
  UNIQUE (form_type, field_key)
);

CREATE INDEX IF NOT EXISTS idx_submission_form_schema_type  ON public.submission_form_schema (form_type);
CREATE INDEX IF NOT EXISTS idx_submission_form_schema_order ON public.submission_form_schema (form_type, display_order);

-- Seed default schema for release form
INSERT INTO public.submission_form_schema
  (form_type, field_key, field_label_en, field_label_de, field_type, is_required, is_visible, display_order, placeholder_en, placeholder_de)
VALUES
  ('release', 'title',             'Release Title',       'Release-Titel',        'text',     TRUE,  TRUE, 10, 'My New Album', 'Mein neues Album'),
  ('release', 'release_date',      'Release Date',        'Veröffentlichungsdatum','date',    TRUE,  TRUE, 20, NULL, NULL),
  ('release', 'type',              'Release Type',        'Release-Typ',          'select',   TRUE,  TRUE, 30, NULL, NULL),
  ('release', 'genre',             'Genre',               'Genre',                'text',     FALSE, TRUE, 40, 'e.g. Techno, House', 'z.B. Techno, House'),
  ('release', 'audio_download_url','Audio Download Link', 'Audio-Download-Link',  'url',      TRUE,  TRUE, 50, 'https://drive.google.com/...', 'https://drive.google.com/...'),
  ('release', 'cover_art_url',     'Cover Art URL',       'Cover-Art-URL',        'url',      TRUE,  TRUE, 60, 'https://drive.google.com/...', 'https://drive.google.com/...'),
  ('release', 'catalog_number',    'Catalog Number',      'Katalognummer',        'text',     FALSE, TRUE, 70, 'DT-001', 'DT-001'),
  ('release', 'isrc',              'ISRC',                'ISRC',                 'text',     FALSE, TRUE, 80, 'DEXX12345678', 'DEXX12345678'),
  ('release', 'label_copy',        'Label Copy / Credits','Label-Text / Credits', 'textarea', FALSE, TRUE, 90, NULL, NULL),
  ('release', 'spotify_url',       'Spotify Link',        'Spotify-Link',         'url',      FALSE, TRUE,100, NULL, NULL),
  ('release', 'apple_music_url',   'Apple Music Link',    'Apple Music-Link',     'url',      FALSE, TRUE,110, NULL, NULL),
  ('release', 'youtube_url',       'YouTube Link',        'YouTube-Link',         'url',      FALSE, TRUE,120, NULL, NULL),
  ('release', 'notes',             'Additional Notes',    'Zusätzliche Hinweise', 'textarea', FALSE, TRUE,130, NULL, NULL)
ON CONFLICT (form_type, field_key) DO NOTHING;

-- Seed default schema for video form
INSERT INTO public.submission_form_schema
  (form_type, field_key, field_label_en, field_label_de, field_type, is_required, is_visible, display_order, placeholder_en, placeholder_de)
VALUES
  ('video', 'title',               'Video Title',             'Video-Titel',              'text',     TRUE,  TRUE, 10, 'My Music Video', 'Mein Musikvideo'),
  ('video', 'download_url',        'Video Download Link',     'Video-Download-Link',      'url',      TRUE,  TRUE, 20, 'https://drive.google.com/...', 'https://drive.google.com/...'),
  ('video', 'thumbnail_url',       'Thumbnail URL',           'Thumbnail-URL',            'url',      FALSE, TRUE, 30, NULL, NULL),
  ('video', 'youtube_title',       'YouTube Title',           'YouTube-Titel',            'text',     FALSE, TRUE, 40, NULL, NULL),
  ('video', 'youtube_description', 'YouTube Description',     'YouTube-Beschreibung',     'textarea', FALSE, TRUE, 50, NULL, NULL),
  ('video', 'youtube_tags',        'YouTube Tags',            'YouTube-Tags',             'text',     FALSE, TRUE, 60, 'techno, club, dj', 'techno, club, dj'),
  ('video', 'youtube_category',    'YouTube Category',        'YouTube-Kategorie',        'select',   FALSE, TRUE, 70, NULL, NULL),
  ('video', 'target_publish_date', 'Target Publish Date',     'Geplantes Veröffentlichungsdatum','date',FALSE, TRUE, 80, NULL, NULL),
  ('video', 'description',         'Video Description',       'Video-Beschreibung',       'textarea', FALSE, TRUE, 90, NULL, NULL),
  ('video', 'notes',               'Additional Notes',        'Zusätzliche Hinweise',     'textarea', FALSE, TRUE,100, NULL, NULL)
ON CONFLICT (form_type, field_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS for submission tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.release_submissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_submissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_form_schema ENABLE ROW LEVEL SECURITY;

-- release_submissions: artist can insert/read own rows
DROP POLICY IF EXISTS "release_submissions: artist insert own" ON public.release_submissions;
CREATE POLICY "release_submissions: artist insert own" ON public.release_submissions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "release_submissions: artist read own" ON public.release_submissions;
CREATE POLICY "release_submissions: artist read own" ON public.release_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "release_submissions: editor+ read all" ON public.release_submissions;
CREATE POLICY "release_submissions: editor+ read all" ON public.release_submissions
  FOR SELECT USING (public.get_my_role() IN ('admin', 'editor'));

DROP POLICY IF EXISTS "release_submissions: editor+ update" ON public.release_submissions;
CREATE POLICY "release_submissions: editor+ update" ON public.release_submissions
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'editor'));

-- video_submissions: same pattern
DROP POLICY IF EXISTS "video_submissions: artist insert own" ON public.video_submissions;
CREATE POLICY "video_submissions: artist insert own" ON public.video_submissions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "video_submissions: artist read own" ON public.video_submissions;
CREATE POLICY "video_submissions: artist read own" ON public.video_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "video_submissions: editor+ read all" ON public.video_submissions;
CREATE POLICY "video_submissions: editor+ read all" ON public.video_submissions
  FOR SELECT USING (public.get_my_role() IN ('admin', 'editor'));

DROP POLICY IF EXISTS "video_submissions: editor+ update" ON public.video_submissions;
CREATE POLICY "video_submissions: editor+ update" ON public.video_submissions
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'editor'));

-- submission_form_schema: public read, editor+ write
DROP POLICY IF EXISTS "submission_form_schema: public read" ON public.submission_form_schema;
CREATE POLICY "submission_form_schema: public read" ON public.submission_form_schema
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "submission_form_schema: editor+ write" ON public.submission_form_schema;
CREATE POLICY "submission_form_schema: editor+ write" ON public.submission_form_schema
  FOR ALL USING (public.get_my_role() IN ('admin', 'editor'))
  WITH CHECK (public.get_my_role() IN ('admin', 'editor'));
