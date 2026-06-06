-- Migration: Add EPK gallery photos and custom theme tokens to artist_profiles
-- 2026-06-07

ALTER TABLE artist_profiles
  ADD COLUMN IF NOT EXISTS epk_gallery_photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS epk_custom_theme_tokens jsonb DEFAULT NULL;

COMMENT ON COLUMN artist_profiles.epk_gallery_photos IS
  'Array of R2 URLs for additional press/EPK gallery photos.';

COMMENT ON COLUMN artist_profiles.epk_custom_theme_tokens IS
  'JSON object with custom EPK color tokens: { bg, text, accent, heading }.';
