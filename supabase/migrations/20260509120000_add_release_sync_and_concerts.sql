-- =============================================================================
-- Migration: add_release_sync_and_concerts
-- =============================================================================
-- Adds external-API sync fields to `releases` so Spotify and Discogs releases
-- can be deduplicated by ISRC or barcode.
-- Adds optional metadata columns (preview_url, smart_url, popularity).
-- Adds `api_source` + `rate_limited` columns to `sync_logs` so the health
-- dashboard can report per-API status.
-- Adds a `concerts` table for Songkick live event data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- releases — new sync columns
-- ---------------------------------------------------------------------------

ALTER TABLE releases
  ADD COLUMN IF NOT EXISTS spotify_id       TEXT,
  ADD COLUMN IF NOT EXISTS discogs_id       TEXT,
  ADD COLUMN IF NOT EXISTS isrc             TEXT,
  ADD COLUMN IF NOT EXISTS barcode          TEXT,
  ADD COLUMN IF NOT EXISTS catalog_number   TEXT,
  ADD COLUMN IF NOT EXISTS preview_url      TEXT,
  ADD COLUMN IF NOT EXISTS smart_url        TEXT,
  ADD COLUMN IF NOT EXISTS popularity       INTEGER;

-- Unique constraint on spotify_id so we can UPSERT on conflict
CREATE UNIQUE INDEX IF NOT EXISTS releases_spotify_id_key
  ON releases (spotify_id)
  WHERE spotify_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- sync_logs — api_source + rate_limited
-- ---------------------------------------------------------------------------

ALTER TABLE sync_logs
  ADD COLUMN IF NOT EXISTS api_source    TEXT NOT NULL DEFAULT 'itunes',
  ADD COLUMN IF NOT EXISTS rate_limited  BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- concerts — Songkick live event data
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS concerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id       UUID REFERENCES artists(id) ON DELETE CASCADE,
  artist_name     TEXT NOT NULL,
  event_name      TEXT NOT NULL,
  venue_name      TEXT,
  venue_city      TEXT,
  venue_country   TEXT,
  concert_date    DATE NOT NULL,
  ticket_url      TEXT,
  songkick_id     TEXT UNIQUE,
  status          TEXT NOT NULL DEFAULT 'ok',  -- 'ok' | 'cancelled'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: same pattern as other tables (authenticated users can manage)
ALTER TABLE concerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated reads on concerts"
  ON concerts FOR SELECT
  USING (auth.role() = 'authenticated' OR true);   -- public read for now

CREATE POLICY "Allow admin inserts on concerts"
  ON concerts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow admin updates on concerts"
  ON concerts FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin deletes on concerts"
  ON concerts FOR DELETE
  USING (auth.role() = 'authenticated');
