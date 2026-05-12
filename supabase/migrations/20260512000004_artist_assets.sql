CREATE TABLE IF NOT EXISTS public.artist_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  r2_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.artist_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artist_assets_select_own" ON public.artist_assets;
DROP POLICY IF EXISTS "artist_assets_insert_own" ON public.artist_assets;
DROP POLICY IF EXISTS "artist_assets_delete_own" ON public.artist_assets;
DROP POLICY IF EXISTS "artist_assets_admin_all" ON public.artist_assets;

CREATE POLICY "artist_assets_select_own" ON public.artist_assets
  FOR SELECT USING (
    artist_id = (SELECT id FROM public.artists WHERE user_id = auth.uid())
  );

CREATE POLICY "artist_assets_insert_own" ON public.artist_assets
  FOR INSERT WITH CHECK (
    artist_id = (SELECT id FROM public.artists WHERE user_id = auth.uid())
  );

CREATE POLICY "artist_assets_delete_own" ON public.artist_assets
  FOR DELETE USING (
    artist_id = (SELECT id FROM public.artists WHERE user_id = auth.uid())
  );

CREATE POLICY "artist_assets_admin_all" ON public.artist_assets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
