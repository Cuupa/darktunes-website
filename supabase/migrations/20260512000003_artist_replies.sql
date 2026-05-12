CREATE TABLE IF NOT EXISTS public.artist_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.label_messages(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) > 0),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.artist_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artist_replies_select_own" ON public.artist_replies;
DROP POLICY IF EXISTS "artist_replies_insert_own" ON public.artist_replies;
DROP POLICY IF EXISTS "artist_replies_admin_all" ON public.artist_replies;

CREATE POLICY "artist_replies_select_own" ON public.artist_replies
  FOR SELECT USING (
    artist_id = (SELECT id FROM public.artists WHERE user_id = auth.uid())
  );

CREATE POLICY "artist_replies_insert_own" ON public.artist_replies
  FOR INSERT WITH CHECK (
    artist_id = (SELECT id FROM public.artists WHERE user_id = auth.uid())
  );

CREATE POLICY "artist_replies_admin_all" ON public.artist_replies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
