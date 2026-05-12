ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES public.artists(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_videos_artist_id ON public.videos (artist_id);
