-- Shared API-wide pacing and backoff. Install before deploying the worker.
-- No credentials or artist data stored. Only service-role callers may access.
CREATE TABLE IF NOT EXISTS public.sync_provider_limits (
  provider TEXT PRIMARY KEY CHECK (provider IN ('itunes','spotify','discogs','songkick','bandsintown')),
  next_request_at TIMESTAMPTZ NOT NULL DEFAULT to_timestamp(0),
  cooldown_until TIMESTAMPTZ NOT NULL DEFAULT to_timestamp(0),
  last_rate_limit_at TIMESTAMPTZ,
  last_request_at TIMESTAMPTZ,
  rate_limit_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sync_provider_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sync_provider_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sync_provider_limits TO service_role;

-- Locks one provider's row across ALL serverless instances.
-- Large waits never reserve a future slot: caller requeues instead.
CREATE OR REPLACE FUNCTION public.reserve_sync_provider_slot(
  p_provider TEXT, p_spacing_ms INTEGER DEFAULT 2500
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.sync_provider_limits;
  v_now TIMESTAMPTZ;
  v_due TIMESTAMPTZ;
  v_wait INTEGER;
BEGIN
  IF p_provider NOT IN ('itunes','spotify','discogs','songkick','bandsintown')
     OR p_provider IS NULL THEN
    RAISE EXCEPTION 'Unsupported sync provider';
  END IF;
  IF p_spacing_ms < 250 OR p_spacing_ms > 30000 OR p_spacing_ms IS NULL THEN
    RAISE EXCEPTION 'Invalid provider spacing';
  END IF;

  INSERT INTO public.sync_provider_limits(provider) VALUES (p_provider)
  ON CONFLICT (provider) DO NOTHING;
  SELECT * INTO v_row FROM public.sync_provider_limits
    WHERE provider=p_provider FOR UPDATE;
  v_now := clock_timestamp();
  v_due := GREATEST(v_now, v_row.next_request_at, v_row.cooldown_until);
  v_wait := GREATEST(0,CEIL(EXTRACT(EPOCH FROM v_due-v_now)*1000)::INTEGER);
  IF v_wait > 8000 THEN
    RETURN v_wait;
  END IF;
  UPDATE public.sync_provider_limits
     SET next_request_at = v_due + make_interval(secs => p_spacing_ms::DOUBLE PRECISION/1000),
         last_request_at = v_due, updated_at = v_now
   WHERE provider=p_provider;
  RETURN v_wait;
END;
$$;

-- A 429 applies to ALL artists and all concurrent workers using this provider.
-- Never shorten an existing cooldown.
CREATE OR REPLACE FUNCTION public.block_sync_provider(
  p_provider TEXT, p_cooldown_ms INTEGER
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_provider NOT IN ('itunes','spotify','discogs','songkick','bandsintown')
     OR p_provider IS NULL THEN
    RAISE EXCEPTION 'Unsupported sync provider';
  END IF;
  IF p_cooldown_ms IS NULL OR p_cooldown_ms < 1000 OR p_cooldown_ms > 86400000 THEN
    RAISE EXCEPTION 'Invalid provider cooldown';
  END IF;
  INSERT INTO public.sync_provider_limits (provider, cooldown_until, last_rate_limit_at, rate_limit_count)
  VALUES (p_provider, now() + make_interval(secs => p_cooldown_ms::DOUBLE PRECISION/1000), now(), 1)
  ON CONFLICT (provider) DO UPDATE
  SET cooldown_until = GREATEST(sync_provider_limits.cooldown_until,EXCLUDED.cooldown_until),
      last_rate_limit_at = EXCLUDED.last_rate_limit_at,
      rate_limit_count = sync_provider_limits.rate_limit_count+1,
      updated_at=now();
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_sync_provider_slot(TEXT,INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_sync_provider(TEXT,INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_sync_provider_slot(TEXT,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.block_sync_provider(TEXT,INTEGER) TO service_role;
