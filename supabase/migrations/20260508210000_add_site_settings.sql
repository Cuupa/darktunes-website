-- Migration: add_site_settings
-- Creates a key-value store for configurable site content (social links, SEO,
-- hero text, etc.) that the Admin CMS can manage without code changes.

CREATE TABLE IF NOT EXISTS public.site_settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: keep updated_at fresh on every update
CREATE OR REPLACE FUNCTION public.set_site_settings_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_site_settings_updated_at();

-- Row Level Security
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Public: read-only SELECT (used by RSC on the frontend)
CREATE POLICY "site_settings_public_read"
  ON public.site_settings FOR SELECT
  USING (true);

-- Authenticated users with admin/editor role: full write access
-- We rely on the profiles table to check role.
CREATE POLICY "site_settings_admin_write"
  ON public.site_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'editor')
    )
  );

-- Seed default values so the frontend always has something to show
INSERT INTO public.site_settings (key, value) VALUES
  ('label_name',           'darkTunes Music Group'),
  ('label_tagline',        'We don''t follow trends—we create them.'),
  ('contact_email',        'info@darktunes.com'),
  ('privacy_policy_url',   'https://darktunes.com/privacy'),
  ('terms_url',            'https://darktunes.com/terms'),
  ('instagram_url',        'https://instagram.com/darktunes'),
  ('youtube_url',          'https://youtube.com/@darktunes'),
  ('spotify_url',          'https://open.spotify.com/user/darktunes'),
  ('spotify_playlist_uri', '37i9dQZF1DWWqNV5cS50j6'),
  ('hero_badge',           '⚡ New Release'),
  ('hero_description',     'Experience the latest evolution in alternative music. A sonic journey that pushes boundaries and defies expectations.'),
  ('seo_title',            'darkTunes Music Group'),
  ('seo_description',      'Official website for darkTunes Music Group — an alternative music label. Discover artists, releases, news, and videos.'),
  ('og_title',             'darkTunes Music Group'),
  ('og_description',       'Alternative music label — artists, releases, news, and videos.')
ON CONFLICT (key) DO NOTHING;
