-- =============================================================================
-- Migration : 20260508000001_add_artist_sync_fields.sql
-- Project   : darkTunes Music Group
-- Description: Add external API ID fields and sync tracking to artists table.
--              Add sync_logs table for tracking sync history and errors.
--
-- Apply via Supabase CLI:  supabase db push
-- Apply manually:          Paste into Supabase Dashboard → SQL Editor → Run
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: artists — add external ID columns + last_synced_at
-- ---------------------------------------------------------------------------
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS spotify_id       TEXT,
  ADD COLUMN IF NOT EXISTS discogs_id       TEXT,
  ADD COLUMN IF NOT EXISTS songkick_id      TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at   TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- TABLE: sync_logs
-- Tracks the result of every artist sync (manual or scheduled).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.sync_status AS ENUM ('success', 'partial', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.sync_logs (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id        UUID        REFERENCES public.artists (id) ON DELETE CASCADE,
  status           public.sync_status NOT NULL,
  message          TEXT,
  releases_synced  INTEGER     NOT NULL DEFAULT 0,
  errors           JSONB       NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_artist_id  ON public.sync_logs (artist_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON public.sync_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY for sync_logs
-- ---------------------------------------------------------------------------
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Admins and editors can read all sync logs
CREATE POLICY "sync_logs: editor+ read"
  ON public.sync_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'editor')
    )
  );

-- Only service role can insert (via Route Handlers with service key)
-- No INSERT policy needed — service role bypasses RLS
