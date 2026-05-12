-- Idempotent schema patch for portal/journalist feature flags and dashboard tables.

CREATE TABLE IF NOT EXISTS public.portal_feature_flags (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  target_role TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portal_feature_flags_target_role
  ON public.portal_feature_flags (target_role);
DROP TRIGGER IF EXISTS trg_portal_feature_flags_updated_at ON public.portal_feature_flags;
CREATE TRIGGER trg_portal_feature_flags_updated_at
  BEFORE UPDATE ON public.portal_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS is_promo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS is_press_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.label_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_label_messages_artist_id_sent_at
  ON public.label_messages (artist_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS public.journalist_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journalist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  release_id UUID REFERENCES public.releases(id) ON DELETE SET NULL,
  asset_key TEXT NOT NULL,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_journalist_downloads_journalist_id
  ON public.journalist_downloads (journalist_id);
CREATE INDEX IF NOT EXISTS idx_journalist_downloads_downloaded_at
  ON public.journalist_downloads (downloaded_at DESC);

CREATE TABLE IF NOT EXISTS public.accreditation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journalist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  publication TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accreditation_requests_journalist_id
  ON public.accreditation_requests (journalist_id);
CREATE INDEX IF NOT EXISTS idx_accreditation_requests_status
  ON public.accreditation_requests (status);
DROP TRIGGER IF EXISTS trg_accreditation_requests_updated_at ON public.accreditation_requests;
CREATE TRIGGER trg_accreditation_requests_updated_at
  BEFORE UPDATE ON public.accreditation_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.portal_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journalist_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accreditation_requests ENABLE ROW LEVEL SECURITY;

INSERT INTO public.portal_feature_flags (id, label, enabled, target_role) VALUES
  ('artist.analytics', 'Artist Analytics', TRUE, 'artist'),
  ('artist.statements', 'Artist Statements', TRUE, 'artist'),
  ('artist.releases', 'Artist Releases', TRUE, 'artist'),
  ('artist.tour', 'Artist Tour', TRUE, 'artist'),
  ('artist.marketing', 'Artist Marketing', TRUE, 'artist'),
  ('artist.messages', 'Artist Messages', TRUE, 'artist'),
  ('journalist.promo_pool', 'Journalist Promo Pool', TRUE, 'journalist'),
  ('journalist.press_kit', 'Journalist Press Kit', TRUE, 'journalist'),
  ('journalist.accreditation', 'Journalist Accreditation', TRUE, 'journalist'),
  ('journalist.press_releases', 'Journalist Press Releases', TRUE, 'journalist'),
  ('journalist.download_history', 'Journalist Download History', TRUE, 'journalist')
ON CONFLICT (id) DO NOTHING;
