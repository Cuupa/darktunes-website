-- Migration: seed_visual_effect_settings
-- Seeds default key-value entries for the three CMS-controlled visual overlay
-- effects (animated noise, CRT scanlines, vignette) added in this sprint.
-- No schema change is required — site_settings is already a key-value store.

INSERT INTO public.site_settings (key, value) VALUES
  ('noise_opacity',         '0.04'),
  ('crt_scanlines_enabled', 'true'),
  ('vignette_intensity',    '0.5')
ON CONFLICT (key) DO NOTHING;
