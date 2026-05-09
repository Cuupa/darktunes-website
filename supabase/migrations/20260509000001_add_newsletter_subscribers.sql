-- Migration: add newsletter_subscribers table
-- Created: 2026-05-09

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  name       TEXT,
  source     TEXT NOT NULL DEFAULT 'website',
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT newsletter_subscribers_email_key UNIQUE (email)
);

-- Row-level security: only service-role can read/insert
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Admins/service role bypass RLS
CREATE POLICY "service_role_all" ON newsletter_subscribers
  USING (TRUE)
  WITH CHECK (TRUE);

-- No anon read/write
REVOKE ALL ON newsletter_subscribers FROM anon;
REVOKE ALL ON newsletter_subscribers FROM authenticated;

-- Index for email lookups
CREATE INDEX IF NOT EXISTS newsletter_subscribers_email_idx
  ON newsletter_subscribers (email);
