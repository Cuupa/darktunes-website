-- =============================================================================
-- Migration: Visibility Toggles + Referential Integrity (Cascading Deletes)
-- =============================================================================
-- 1. Add is_visible column to artists and releases (soft-hide without deleting)
-- 2. Upgrade releases.artist_id FK from ON DELETE SET NULL → ON DELETE CASCADE
--    so deleting an artist automatically removes all their releases.
-- 3. Update public-read RLS policies so anonymous users only see visible data,
--    while admins/editors can still see everything.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. is_visible columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.artists  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill existing rows (no-op when the column was just created fresh)
UPDATE public.artists  SET is_visible = TRUE WHERE is_visible IS NULL;
UPDATE public.releases SET is_visible = TRUE WHERE is_visible IS NULL;

CREATE INDEX IF NOT EXISTS idx_artists_is_visible  ON public.artists  (is_visible);
CREATE INDEX IF NOT EXISTS idx_releases_is_visible ON public.releases (is_visible);

-- ---------------------------------------------------------------------------
-- 2. Upgrade releases.artist_id FK to ON DELETE CASCADE
--    Drop the old constraint (SET NULL) and re-add with CASCADE.
-- ---------------------------------------------------------------------------
ALTER TABLE public.releases
  DROP CONSTRAINT IF EXISTS releases_artist_id_fkey;

ALTER TABLE public.releases
  ADD CONSTRAINT releases_artist_id_fkey
  FOREIGN KEY (artist_id)
  REFERENCES public.artists (id)
  ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. Update RLS policies
--    Public (anon) reads are restricted to visible rows.
--    Admins and editors see everything.
-- ---------------------------------------------------------------------------

-- artists
DROP POLICY IF EXISTS "artists: public read"         ON public.artists;
DROP POLICY IF EXISTS "artists: public read visible" ON public.artists;
CREATE POLICY "artists: public read visible" ON public.artists
  FOR SELECT USING (
    is_visible = TRUE
    OR public.get_my_role() IN ('admin', 'editor')
  );

-- releases (cascading: also hidden when their artist is hidden)
DROP POLICY IF EXISTS "releases: public read"         ON public.releases;
DROP POLICY IF EXISTS "releases: public read visible" ON public.releases;
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

-- concerts (cascading: hidden when their artist is hidden)
DROP POLICY IF EXISTS "concerts: public read"         ON public.concerts;
DROP POLICY IF EXISTS "concerts: public read visible" ON public.concerts;
CREATE POLICY "concerts: public read visible" ON public.concerts
  FOR SELECT USING (
    artist_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id AND a.is_visible = TRUE
    )
    OR public.get_my_role() IN ('admin', 'editor')
  );
