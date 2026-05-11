-- Migration: Add social, shop, and Bandcamp URL columns to artists table
-- 2026-05-11 19:00:00 UTC

ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS facebook_url  TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS twitter_url   TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS tiktok_url    TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS bandcamp_url  TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS shop_url      TEXT;
