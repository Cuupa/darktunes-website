-- =============================================================================
-- Migration: press_and_promo_pool
-- =============================================================================
-- Adds the Press & Media ecosystem:
--   1. journalist value added to the user_role enum
--   2. press_photos   — public EPK downloadable press photos
--   3. promo_tracks   — private unreleased audio (journalist-gated)
--   4. journalist_applications — applications for promo-pool access
--
-- Row Level Security enforced at the DB layer for all new tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add journalist value to user_role enum
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE 'journalist';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. press_photos — publicly visible EPK photos stored in R2
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

ALTER TABLE public.press_photos ENABLE ROW LEVEL SECURITY;

-- Anyone can read press photos (public EPK)
CREATE POLICY "press_photos: public read"
  ON public.press_photos FOR SELECT USING (TRUE);

-- Only admins can write
CREATE POLICY "press_photos: admin all"
  ON public.press_photos FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- 3. promo_tracks — private unreleased audio (R2 key only, no public URL)
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

ALTER TABLE public.promo_tracks ENABLE ROW LEVEL SECURITY;

-- Only journalists and admins can read track metadata
CREATE POLICY "promo_tracks: journalist read"
  ON public.promo_tracks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('journalist', 'admin')
    )
  );

-- Only admins can manage tracks
CREATE POLICY "promo_tracks: admin all"
  ON public.promo_tracks FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- 4. journalist_applications — promo-pool access requests
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

ALTER TABLE public.journalist_applications ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own application
CREATE POLICY "journalist_applications: own read"
  ON public.journalist_applications FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users can insert their own application
CREATE POLICY "journalist_applications: own insert"
  ON public.journalist_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can manage all applications
CREATE POLICY "journalist_applications: admin all"
  ON public.journalist_applications FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
