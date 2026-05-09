-- =============================================================================
-- Migration: artist_portal
-- =============================================================================
-- Adds multi-tenant Artist Dashboard support:
--   1. `user_id` column on `artists` — links each artist to a Supabase Auth user
--   2. `artist_profiles` — EPK profile data managed by the artist themselves
--   3. `streaming_stats`  — monthly platform stream counts per artist
--   4. `sales_statements` — royalty PDF statements stored privately in R2
--
-- Row Level Security ensures artists can only SELECT/UPDATE their own rows.
-- Security is enforced at the DB layer; no middleware-only filtering.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. artists — add user_id column for multi-tenant ownership
-- ---------------------------------------------------------------------------

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;

-- One Supabase user → at most one artist
CREATE UNIQUE INDEX IF NOT EXISTS artists_user_id_key
  ON public.artists (user_id)
  WHERE user_id IS NOT NULL;

-- RLS: artists can update their own row via user_id
CREATE POLICY "artists: own artist update"
  ON public.artists FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. artist_profiles — EPK profile data (one row per artist)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.artist_profiles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id      UUID        NOT NULL UNIQUE REFERENCES public.artists (id) ON DELETE CASCADE,
  bio            TEXT,
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

CREATE INDEX IF NOT EXISTS idx_artist_profiles_artist_id ON public.artist_profiles (artist_id);

DROP TRIGGER IF EXISTS trg_artist_profiles_updated_at ON public.artist_profiles;
CREATE TRIGGER trg_artist_profiles_updated_at
  BEFORE UPDATE ON public.artist_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.artist_profiles ENABLE ROW LEVEL SECURITY;

-- Artists can read their own profile
CREATE POLICY "artist_profiles: artist read own"
  ON public.artist_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id
        AND a.user_id = auth.uid()
    )
  );

-- Artists can update their own profile
CREATE POLICY "artist_profiles: artist update own"
  ON public.artist_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id
        AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id
        AND a.user_id = auth.uid()
    )
  );

-- Admins can manage all profiles
CREATE POLICY "artist_profiles: admin all"
  ON public.artist_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- 3. streaming_stats — monthly platform streams per artist
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.streaming_stats (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id   UUID        NOT NULL REFERENCES public.artists (id) ON DELETE CASCADE,
  platform    TEXT        NOT NULL,   -- 'spotify' | 'apple_music' | 'youtube' | 'other'
  period      TEXT        NOT NULL,   -- 'YYYY-MM'
  streams     BIGINT      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (artist_id, platform, period)
);

CREATE INDEX IF NOT EXISTS idx_streaming_stats_artist_id ON public.streaming_stats (artist_id);
CREATE INDEX IF NOT EXISTS idx_streaming_stats_period    ON public.streaming_stats (period DESC);

ALTER TABLE public.streaming_stats ENABLE ROW LEVEL SECURITY;

-- Artists can read their own streaming stats
CREATE POLICY "streaming_stats: artist read own"
  ON public.streaming_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id
        AND a.user_id = auth.uid()
    )
  );

-- Artists cannot self-insert or update stats — only admins/system can write
CREATE POLICY "streaming_stats: admin all"
  ON public.streaming_stats FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- 4. sales_statements — royalty PDF statements stored in R2
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sales_statements (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id   UUID           NOT NULL REFERENCES public.artists (id) ON DELETE CASCADE,
  filename    TEXT           NOT NULL,
  r2_key      TEXT           NOT NULL UNIQUE,
  period      TEXT           NOT NULL,   -- 'YYYY-MM' or 'Q1-YYYY'
  amount_eur  NUMERIC(10, 2),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_statements_artist_id ON public.sales_statements (artist_id);
CREATE INDEX IF NOT EXISTS idx_sales_statements_created_at ON public.sales_statements (created_at DESC);

ALTER TABLE public.sales_statements ENABLE ROW LEVEL SECURITY;

-- Artists can only SELECT their own statements (no self-upload)
CREATE POLICY "sales_statements: artist read own"
  ON public.sales_statements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id
        AND a.user_id = auth.uid()
    )
  );

-- Admins can manage all statements
CREATE POLICY "sales_statements: admin all"
  ON public.sales_statements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
