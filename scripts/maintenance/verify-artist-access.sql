-- Run after harden-artist-access.sql. Synthetic data is always rolled back.
BEGIN;
DO $$
DECLARE u uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.access_user',u::text,true);
  PERFORM set_config('test.access_user_b',u2::text,true);
  PERFORM set_config('test.access_artist',a::text,true);
  PERFORM set_config('test.foreign_artist',b::text,true);
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
    VALUES(u,u::text||'@example.invalid',jsonb_build_object('role','admin','artist_id',a), '{}'::jsonb),
          (u2,u2::text||'@example.invalid',jsonb_build_object('role','admin','artist_id',b), '{}'::jsonb);
  IF (SELECT role FROM public.users WHERE id=u) <> 'user' THEN
    RAISE EXCEPTION 'Signup metadata granted a privileged role';
  END IF;
  IF EXISTS(SELECT 1 FROM public.artist_members WHERE user_id=u) THEN
    RAISE EXCEPTION 'Signup metadata granted artist membership';
  END IF;
  INSERT INTO public.artists(id,name,slug,is_visible) VALUES
    (a,'Security test A',a::text,false),(b,'Security test B',b::text,false);
  INSERT INTO public.artist_members(user_id,artist_id,member_role) VALUES(u,a,'owner'),(u2,b,'owner');
  INSERT INTO public.artist_private_data(artist_id,email) VALUES(a,'a@example.invalid'),(b,'b@example.invalid');
  INSERT INTO public.streaming_stats(artist_id,platform,period,streams) VALUES(a,'test','security-test',1),(b,'test','security-test',1);
  INSERT INTO public.sales_statements(artist_id,filename,r2_key,period,status) VALUES
    (a,'test.pdf',a::text,'security-test','label_approved'),(b,'test.pdf',b::text,'security-test','label_approved');
END;
$$;
SELECT set_config('request.jwt.claim.sub',current_setting('test.access_user'),true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.access_user'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE a uuid := current_setting('test.access_artist')::uuid; b uuid := current_setting('test.foreign_artist')::uuid; n integer;
BEGIN
  SELECT count(*) INTO n FROM public.artist_private_data WHERE artist_id=a;
  IF n<>1 THEN RAISE EXCEPTION 'Own private data inaccessible'; END IF;
  SELECT count(*) INTO n FROM public.artist_private_data WHERE artist_id=b;
  IF n<>0 THEN RAISE EXCEPTION 'Foreign private data exposed'; END IF;
  SELECT count(*) INTO n FROM public.streaming_stats WHERE artist_id=b;
  IF n<>0 THEN RAISE EXCEPTION 'Foreign streaming data exposed'; END IF;
  SELECT count(*) INTO n FROM public.sales_statements WHERE artist_id=b;
  IF n<>0 THEN RAISE EXCEPTION 'Foreign financial data exposed'; END IF;
  SELECT count(*) INTO n FROM public.sales_statements WHERE artist_id=a;
  IF n<>1 THEN RAISE EXCEPTION 'Approved own statement inaccessible'; END IF;
  UPDATE public.artist_private_data SET email='own@example.invalid' WHERE artist_id=a;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'Own private data update rejected'; END IF;
  UPDATE public.artist_private_data SET email='foreign@example.invalid' WHERE artist_id=b;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'Foreign private data modified'; END IF;
  UPDATE public.users SET full_name='Security check' WHERE id=auth.uid();
  BEGIN
    UPDATE public.users SET role='admin' WHERE id=auth.uid();
    RAISE EXCEPTION 'Role escalation allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.artists SET user_id=auth.uid(),is_visible=true WHERE id=a;
    RAISE EXCEPTION 'Artist ownership/publication escalation allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.create_release_submission_with_tracks('{}'::jsonb,'[]'::jsonb);
    RAISE EXCEPTION 'Service-only submission RPC executable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('test.access_user_b'),true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.access_user_b'),'role','authenticated')::text,true);
SELECT set_config('test.access_artist',current_setting('test.foreign_artist'),true);
SELECT set_config('test.foreign_artist',(SELECT artist_id::text FROM public.artist_members WHERE user_id=current_setting('test.access_user')::uuid),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE a uuid := current_setting('test.access_artist')::uuid; b uuid := current_setting('test.foreign_artist')::uuid; n integer;
BEGIN
  SELECT count(*) INTO n FROM public.artist_private_data WHERE artist_id=a;
  IF n<>1 THEN RAISE EXCEPTION 'Own private data inaccessible'; END IF;
  SELECT count(*) INTO n FROM public.artist_private_data WHERE artist_id=b;
  IF n<>0 THEN RAISE EXCEPTION 'Foreign private data exposed'; END IF;
  SELECT count(*) INTO n FROM public.streaming_stats WHERE artist_id=b;
  IF n<>0 THEN RAISE EXCEPTION 'Foreign streaming data exposed'; END IF;
  SELECT count(*) INTO n FROM public.sales_statements WHERE artist_id=b;
  IF n<>0 THEN RAISE EXCEPTION 'Foreign financial data exposed'; END IF;
  SELECT count(*) INTO n FROM public.sales_statements WHERE artist_id=a;
  IF n<>1 THEN RAISE EXCEPTION 'Approved own statement inaccessible'; END IF;
  UPDATE public.artist_private_data SET email='own@example.invalid' WHERE artist_id=a;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'Own private data update rejected'; END IF;
  UPDATE public.artist_private_data SET email='foreign@example.invalid' WHERE artist_id=b;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'Foreign private data modified'; END IF;
  UPDATE public.users SET full_name='Security check' WHERE id=auth.uid();
  BEGIN
    UPDATE public.users SET role='admin' WHERE id=auth.uid();
    RAISE EXCEPTION 'Role escalation allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.artists SET user_id=auth.uid(),is_visible=true WHERE id=a;
    RAISE EXCEPTION 'Artist ownership/publication escalation allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.create_release_submission_with_tracks('{}'::jsonb,'[]'::jsonb);
    RAISE EXCEPTION 'Service-only submission RPC executable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$$;
RESET ROLE;
UPDATE public.users SET role='admin' WHERE id=current_setting('test.access_user')::uuid;
SELECT set_config('request.jwt.claim.sub',current_setting('test.access_user'),true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.access_user'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.artist_private_data WHERE artist_id IN (current_setting('test.access_artist')::uuid,current_setting('test.foreign_artist')::uuid)) <> 2 THEN
    RAISE EXCEPTION 'Admin cannot read both test artists';
  END IF;
END; $$;

RESET ROLE;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND (qual LIKE '%am.artist_id = am.artist_id%' OR with_check LIKE '%am.artist_id = am.artist_id%' OR qual LIKE '%am.artist_id = am.id%')) THEN
    RAISE EXCEPTION 'Ambiguous artist policies remain';
  END IF;
  IF has_function_privilege('anon','public.create_release_submission_with_tracks(jsonb,jsonb)','execute')
    OR has_function_privilege('authenticated','public.replace_rejected_release_submission_with_tracks(uuid,jsonb,jsonb)','execute') THEN
    RAISE EXCEPTION 'Unsafe RPC grants remain';
  END IF;
END;
$$;
ROLLBACK;
