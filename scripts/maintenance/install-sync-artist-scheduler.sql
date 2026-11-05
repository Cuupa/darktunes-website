-- Deploy on darkTunes Supabase BEFORE deploying the scheduler/UI code.
-- Safe to run repeatedly. Does not modify existing sync_queue rows.
CREATE TABLE IF NOT EXISTS public.sync_artist_state (
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('itunes','spotify','discogs','songkick','bandsintown')),
  last_success_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_status TEXT NOT NULL DEFAULT 'scheduled' CHECK (last_status IN ('scheduled','success','error','cooldown','permanent')),
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(artist_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_sync_artist_state_due
  ON public.sync_artist_state(next_due_at) WHERE last_status <> 'permanent';
ALTER TABLE public.sync_artist_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sync_artist_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sync_artist_state TO service_role;

ALTER TABLE public.sync_provider_limits ADD COLUMN IF NOT EXISTS last_success_log_at TIMESTAMPTZ;

-- Retain one successful per-provider log per hour, errors and partial failures
-- are logged normally. Atomic across simultaneous Vercel instances.
CREATE OR REPLACE FUNCTION public.allow_sync_success_log(
  p_provider TEXT, p_window_seconds INTEGER DEFAULT 3600
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_last TIMESTAMPTZ;
BEGIN
  IF p_provider NOT IN ('itunes','spotify','discogs','songkick','bandsintown')
     OR p_provider IS NULL THEN RETURN TRUE; END IF;
  IF p_window_seconds < 60 OR p_window_seconds > 86400 THEN
     RAISE EXCEPTION 'Invalid success log interval';
  END IF;
  INSERT INTO public.sync_provider_limits(provider) VALUES (p_provider)
  ON CONFLICT (provider) DO NOTHING;
  SELECT last_success_log_at INTO v_last
  FROM public.sync_provider_limits WHERE provider=p_provider FOR UPDATE;
  IF v_last IS NOT NULL AND v_last > now() - make_interval(secs => p_window_seconds) THEN
    RETURN FALSE;
  END IF;
  UPDATE public.sync_provider_limits SET last_success_log_at=now()
  WHERE provider=p_provider;
  RETURN TRUE;
END;
$$;

-- One state row per artist & provider. Successful sources remain completed
-- even if another provider on the same artist is rate limited.
CREATE OR REPLACE FUNCTION public.record_sync_artist_outcome(
  p_artist_id UUID,
  p_provider TEXT,
  p_outcome TEXT,
  p_error TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_delay INTERVAL;
  v_next TIMESTAMPTZ;
BEGIN
  IF p_provider NOT IN ('itunes','spotify','discogs','songkick','bandsintown') OR p_provider IS NULL THEN
    RAISE EXCEPTION 'Unsupported sync provider';
  END IF;
  IF p_outcome NOT IN ('success','error','cooldown','permanent') OR p_outcome IS NULL THEN
    RAISE EXCEPTION 'Invalid sync outcome';
  END IF;
  v_delay := CASE p_provider
    WHEN 'itunes' THEN INTERVAL '24 hours'
    WHEN 'spotify' THEN INTERVAL '24 hours'
    WHEN 'discogs' THEN INTERVAL '7 days'
    WHEN 'songkick' THEN INTERVAL '12 hours'
    WHEN 'bandsintown' THEN INTERVAL '12 hours'
  END;
  v_next := CASE p_outcome
    WHEN 'success' THEN now() + v_delay
    WHEN 'permanent' THEN now() + INTERVAL '7 days'
    WHEN 'cooldown' THEN GREATEST(now() + INTERVAL '15 minutes',
      COALESCE((SELECT cooldown_until FROM public.sync_provider_limits WHERE provider=p_provider),now()))
    ELSE now() + INTERVAL '2 hours'
  END;
  -- Deterministic 0-60 minute spread for recurring successful syncs.
  IF p_outcome='success' THEN
    v_next := v_next + (get_byte(decode(md5(p_artist_id::TEXT || p_provider), 'hex'),0) * INTERVAL '14 seconds');
  END IF;
  INSERT INTO public.sync_artist_state(
    artist_id,provider,last_success_at,last_attempt_at,next_due_at,last_status,last_error
  ) VALUES (
    p_artist_id,p_provider,CASE WHEN p_outcome='success' THEN now() ELSE NULL END,
    now(),v_next,p_outcome,CASE WHEN p_outcome='success' THEN NULL ELSE left(p_error,300) END
  )
  ON CONFLICT (artist_id,provider) DO UPDATE SET
    last_success_at=CASE WHEN p_outcome='success' THEN now() ELSE sync_artist_state.last_success_at END,
    last_attempt_at=now(),
    next_due_at=v_next,
    last_status=p_outcome,
    last_error=CASE WHEN p_outcome='success' THEN NULL ELSE left(p_error,300) END,
    updated_at=now();
END;
$$;

-- Called by the existing authenticated /api/sync/queue cron endpoint.
-- Single transaction + advisory lock prevents duplicate scheduler batches.
CREATE OR REPLACE FUNCTION public.schedule_due_artist_syncs(p_limit INTEGER DEFAULT 100)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 250 THEN
     RAISE EXCEPTION 'Invalid scheduler batch size';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('darktunes_artist_sync_scheduler'));
  -- Seed new artists with stable, provider-specific spread across 24 hours.
  INSERT INTO public.sync_artist_state(artist_id,provider,next_due_at)
  SELECT a.id,p.provider,
    now() + (get_byte(decode(md5(a.id::TEXT || p.provider),'hex'),0) * INTERVAL '338 seconds')
  FROM public.artists a
  CROSS JOIN LATERAL (
    VALUES ('itunes', TRUE),
           ('spotify', NULLIF(a.spotify_id,'') IS NOT NULL),
           ('discogs', NULLIF(a.discogs_id,'') IS NOT NULL),
           ('songkick', NULLIF(a.songkick_id,'') IS NOT NULL),
           ('bandsintown', NULLIF(a.bandsintown_id,'') IS NOT NULL)
  ) AS p(provider,eligible)
  WHERE p.eligible
  ON CONFLICT (artist_id,provider) DO NOTHING;

  WITH due AS (
    SELECT s.artist_id,s.provider,s.next_due_at
    FROM public.sync_artist_state s
    WHERE s.next_due_at<=now()
      AND NOT EXISTS (
        SELECT 1 FROM public.sync_queue q
         WHERE q.artist_id=s.artist_id
           AND q.status IN ('pending','running')
           AND (q.job_type=s.provider OR q.job_type='full')
      )
    ORDER BY s.next_due_at ASC,s.artist_id
    LIMIT p_limit
  )
  INSERT INTO public.sync_queue(artist_id,job_type,status,scheduled_at)
  SELECT artist_id,provider,'pending',now() FROM due;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.allow_sync_success_log(TEXT,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_sync_artist_outcome(UUID,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.schedule_due_artist_syncs(INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.allow_sync_success_log(TEXT,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_sync_artist_outcome(UUID,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.schedule_due_artist_syncs(INTEGER) TO service_role;
