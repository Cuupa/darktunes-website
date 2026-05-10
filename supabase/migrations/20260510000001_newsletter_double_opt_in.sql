-- Migration: newsletter_subscribers — Double Opt-In columns
-- Created: 2026-05-10
--
-- Adds status enum and verification_token to support GDPR-compliant DOI flow.
-- Existing rows (subscribed via the old direct-subscribe flow) are migrated to
-- 'subscribed' so they are not accidentally invalidated.

-- 1. Add the verification token column (nullable for backwards-compat).
ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS verification_token UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'subscribed'));

-- 2. Back-fill existing rows: treat them as already subscribed.
UPDATE newsletter_subscribers
  SET status = 'subscribed'
  WHERE status = 'pending';

-- 3. Allow anonymous clients to INSERT a pending subscription row.
--    The service-role key is still used by the Server Action, but the explicit
--    policy documents the intended access model and allows edge-case direct use.
--    Read access remains restricted to the service role (bypasses RLS entirely).
DROP POLICY IF EXISTS "anon_insert" ON newsletter_subscribers;
CREATE POLICY "anon_insert" ON newsletter_subscribers
  FOR INSERT
  TO anon
  WITH CHECK (status = 'pending');

-- 4. Index for fast token lookups during verification.
CREATE INDEX IF NOT EXISTS newsletter_subscribers_token_idx
  ON newsletter_subscribers (verification_token);
