-- ============================================================================
-- Migration: artist_dashboard_enhancements
-- ============================================================================
-- 1. Add bio_short / bio_medium / bio_long to artist_profiles
-- 2. Add release_checklists table (per-artist release task checklist)
-- ============================================================================

-- 1. Bio lengths on artist_profiles
ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS bio_short  TEXT,   -- ≤ 100 words: social media
  ADD COLUMN IF NOT EXISTS bio_medium TEXT,   -- ≤ 300 words: blogs
  ADD COLUMN IF NOT EXISTS bio_long   TEXT;   -- ≤ 1000 words: press / print

-- 2. release_checklists — per-artist, per-release task tracking
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

ALTER TABLE public.release_checklists ENABLE ROW LEVEL SECURITY;

-- Artists can only read/update their own checklists
CREATE POLICY "release_checklists: artist read own"
  ON public.release_checklists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "release_checklists: artist insert own"
  ON public.release_checklists FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "release_checklists: artist update own"
  ON public.release_checklists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id AND a.user_id = auth.uid()
    )
  );

-- Admins can manage all checklists
CREATE POLICY "release_checklists: admin all"
  ON public.release_checklists FOR ALL
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
