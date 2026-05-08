-- =============================================================================
-- Migration : 20240101000000_initial_schema.sql
-- Project   : darkTunes Music Group
-- Description: Full initial schema — tables, enums, indexes, triggers, RLS.
--
-- Apply via Supabase CLI:  supabase db push
-- Apply manually:          Paste into Supabase Dashboard → SQL Editor → Run
--
-- TypeScript types that mirror this schema live in src/types/database.ts.
-- IMPORTANT: Any change to this schema MUST be reflected in a new migration
-- file AND src/types/database.ts must be updated to stay in sync.
-- See AGENTS.md "Database Schema Management".
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'editor', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.release_type AS ENUM ('album', 'ep', 'single');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- HELPER: auto-update updated_at on every row change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- TABLE: profiles
-- One-to-one extension of auth.users managed by Supabase Auth.
-- Created automatically when a new user signs up (see trigger below).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email      TEXT        NOT NULL,
  role       public.user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create a profile row when a new Auth user is registered
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

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
  instagram_url    TEXT,
  youtube_url      TEXT,
  website_url      TEXT,
  featured         BOOLEAN     NOT NULL DEFAULT FALSE,
  country          TEXT,
  email            TEXT,
  vat_number       TEXT,
  is_eu_non_german BOOLEAN     NOT NULL DEFAULT FALSE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artists_slug     ON public.artists (slug);
CREATE INDEX IF NOT EXISTS idx_artists_featured ON public.artists (featured);

DROP TRIGGER IF EXISTS trg_artists_updated_at ON public.artists;
CREATE TRIGGER trg_artists_updated_at
  BEFORE UPDATE ON public.artists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: releases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.releases (
  id              UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT                 NOT NULL,
  -- artist_id is nullable: iTunes-synced releases may not map to a local artist yet
  artist_id       UUID                 REFERENCES public.artists (id) ON DELETE SET NULL,
  artist_name     TEXT                 NOT NULL,
  release_date    DATE                 NOT NULL,
  cover_art       TEXT,
  type            public.release_type  NOT NULL,
  spotify_url     TEXT,
  apple_music_url TEXT,
  youtube_url     TEXT,
  featured        BOOLEAN              NOT NULL DEFAULT FALSE,
  -- itunes_id: unique identifier from Apple iTunes API; used for upsert deduplication
  itunes_id       TEXT                 UNIQUE,
  created_at      TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_releases_artist_id    ON public.releases (artist_id);
CREATE INDEX IF NOT EXISTS idx_releases_release_date ON public.releases (release_date DESC);
CREATE INDEX IF NOT EXISTS idx_releases_featured     ON public.releases (featured);
CREATE INDEX IF NOT EXISTS idx_releases_itunes_id    ON public.releases (itunes_id);

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
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  youtube_id    TEXT        NOT NULL UNIQUE,
  thumbnail_url TEXT,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_youtube_id   ON public.videos (youtube_id);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON public.videos (published_at DESC);

DROP TRIGGER IF EXISTS trg_videos_updated_at ON public.videos;
CREATE TRIGGER trg_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: assets  (Cloudflare R2 metadata registry)
-- Stores metadata about files uploaded to R2; the actual binary lives in R2.
-- r2_key  : the object key inside the R2 bucket (unique)
-- public_url: the public CDN URL returned after upload
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
  -- assets are immutable once uploaded; no updated_at needed
);

CREATE INDEX IF NOT EXISTS idx_assets_uploaded_by ON public.assets (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_assets_mime_type   ON public.assets (mime_type);
CREATE INDEX IF NOT EXISTS idx_assets_created_at  ON public.assets (created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Every table has RLS enabled. Default: deny all. Policies grant access.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own profile
CREATE POLICY "profiles: own read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: own update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "profiles: admin read all"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- artists
-- ---------------------------------------------------------------------------
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artists: public read"
  ON public.artists FOR SELECT USING (TRUE);

CREATE POLICY "artists: editor+ insert"
  ON public.artists FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "artists: editor+ update"
  ON public.artists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "artists: admin delete"
  ON public.artists FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- releases
-- ---------------------------------------------------------------------------
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "releases: public read"
  ON public.releases FOR SELECT USING (TRUE);

CREATE POLICY "releases: editor+ insert"
  ON public.releases FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "releases: editor+ update"
  ON public.releases FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "releases: admin delete"
  ON public.releases FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- news_posts
-- ---------------------------------------------------------------------------
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_posts: public read"
  ON public.news_posts FOR SELECT USING (TRUE);

CREATE POLICY "news_posts: editor+ insert"
  ON public.news_posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "news_posts: editor+ update"
  ON public.news_posts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "news_posts: admin delete"
  ON public.news_posts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- videos
-- ---------------------------------------------------------------------------
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "videos: public read"
  ON public.videos FOR SELECT USING (TRUE);

CREATE POLICY "videos: editor+ insert"
  ON public.videos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "videos: editor+ update"
  ON public.videos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "videos: admin delete"
  ON public.videos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------------
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Only authenticated users (admins/editors) can see uploaded assets
CREATE POLICY "assets: authenticated read"
  ON public.assets FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "assets: editor+ insert"
  ON public.assets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "assets: admin delete"
  ON public.assets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
