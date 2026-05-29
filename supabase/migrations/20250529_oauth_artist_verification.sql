-- =============================================================================
-- OAuth Artist Auto-Verification
-- When a user signs in with Spotify OAuth and their Spotify ID matches an
-- existing artist row, automatically link the account and promote to 'artist'.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_oauth_artist_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_spotify_id TEXT;
  v_artist_id  UUID;
BEGIN
  v_spotify_id := NEW.raw_user_meta_data->>'provider_id';

  IF NEW.raw_app_meta_data->>'provider' = 'spotify' AND v_spotify_id IS NOT NULL THEN
    SELECT id INTO v_artist_id
    FROM public.artists
    WHERE spotify_id = v_spotify_id
    LIMIT 1;

    IF v_artist_id IS NOT NULL THEN
      UPDATE public.artists SET user_id = NEW.id WHERE id = v_artist_id;
      UPDATE public.profiles SET role = 'artist' WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_oauth_artist_verify ON auth.users;
CREATE TRIGGER on_oauth_artist_verify
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_oauth_artist_verification();

-- Add avatar_url and provider columns to profiles for OAuth metadata
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS provider   TEXT NOT NULL DEFAULT 'email';
