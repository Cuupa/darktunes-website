-- verify-portal-rls.sql
--
-- Run in Supabase SQL editor (production or staging) to compare live RLS
-- with the membership-based policies defined in supabase/reset.sql.
--
-- Pass criteria for migrating portal writes from service-role → user JWT:
--   1. Every expected policy name below exists (policy_exists = true)
--   2. No unexpected legacy policies that only allow artists.user_id
--   3. Manual band-member write test still required after this script passes
--
-- This script is read-only.

-- ---------------------------------------------------------------------------
-- 1) Expected portal write policies (membership-based)
-- ---------------------------------------------------------------------------
WITH expected(table_name, policy_name) AS (
  VALUES
    ('artists', 'artists: own artist update'),
    ('artists', 'artists: artist read own'),
    ('artist_epks', 'artist_epks: artist read own'),
    ('artist_epks', 'artist_epks: artist insert own'),
    ('artist_epks', 'artist_epks: artist update own'),
    ('artist_landing_pages', 'artist_landing_pages: artist read own'),
    ('artist_landing_pages', 'artist_landing_pages: artist insert own'),
    ('artist_landing_pages', 'artist_landing_pages: artist update own'),
    ('artist_billing_profiles', 'artist_billing_profiles: artist read own'),
    ('artist_billing_profiles', 'artist_billing_profiles: artist write own'),
    ('artist_documents', 'artist_documents: artist read own'),
    ('artist_documents', 'artist_documents: artist write own'),
    ('epk_fonts', 'epk_fonts: artist insert own'),
    ('epk_fonts', 'epk_fonts: artist delete own'),
    ('epk_share_links', 'epk_share_links: artist insert own'),
    ('epk_share_links', 'epk_share_links: artist update own'),
    ('epk_versions', 'epk_versions: artist insert own'),
    ('label_messages', 'label_messages: artist own read')
)
SELECT
  e.table_name,
  e.policy_name,
  EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = e.table_name
      AND p.policyname = e.policy_name
  ) AS policy_exists
FROM expected e
ORDER BY e.table_name, e.policy_name;

-- ---------------------------------------------------------------------------
-- 2) All policies on portal-critical tables (manual review)
-- ---------------------------------------------------------------------------
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual AS using_expr,
  with_check AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'artists',
    'artist_epks',
    'artist_members',
    'artist_landing_pages',
    'artist_billing_profiles',
    'artist_documents',
    'epk_fonts',
    'epk_share_links',
    'epk_versions',
    'label_messages'
  )
ORDER BY tablename, policyname;

-- ---------------------------------------------------------------------------
-- 3) Legacy smell: policies that mention user_id without artist_members
--    (review rows — not all are wrong; flag for human inspection)
-- ---------------------------------------------------------------------------
SELECT
  tablename,
  policyname,
  cmd,
  qual AS using_expr,
  with_check AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'artists',
    'artist_epks',
    'artist_landing_pages',
    'artist_billing_profiles',
    'artist_documents'
  )
  AND (
    (coalesce(qual, '') ILIKE '%user_id%' AND coalesce(qual, '') NOT ILIKE '%artist_members%')
    OR (coalesce(with_check, '') ILIKE '%user_id%' AND coalesce(with_check, '') NOT ILIKE '%artist_members%')
  )
ORDER BY tablename, policyname;

-- ---------------------------------------------------------------------------
-- 4) Membership coverage sanity (no PII beyond counts)
-- ---------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM public.artists) AS artists_total,
  (SELECT COUNT(*) FROM public.artist_members) AS memberships_total,
  (SELECT COUNT(DISTINCT artist_id) FROM public.artist_members) AS artists_with_members,
  (SELECT COUNT(*) FROM public.artists a
    WHERE a.user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.artist_members am
        WHERE am.artist_id = a.id AND am.user_id = a.user_id
      )
  ) AS artists_user_id_missing_membership;
