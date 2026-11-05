-- Targeted idempotent security patch. No business rows are removed.
BEGIN;
DROP POLICY IF EXISTS "artist_private_data: member read" ON public.artist_private_data;
CREATE POLICY "artist_private_data: member read" ON public.artist_private_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = artist_private_data.artist_id AND am.user_id = auth.uid()
    )
    OR public.get_my_role() IN ('admin', 'editor')
  );

DROP POLICY IF EXISTS "artist_private_data: member write" ON public.artist_private_data;
CREATE POLICY "artist_private_data: member write" ON public.artist_private_data
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = artist_private_data.artist_id AND am.user_id = auth.uid()
    )
    OR public.get_my_role() IN ('admin', 'editor')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = artist_private_data.artist_id AND am.user_id = auth.uid()
    )
    OR public.get_my_role() IN ('admin', 'editor')
  );

DROP POLICY IF EXISTS "artist_news_posts: artist read own" ON public.artist_news_posts;
CREATE POLICY "artist_news_posts: artist read own" ON public.artist_news_posts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_news_posts.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "artist_news_posts: artist insert own" ON public.artist_news_posts;
CREATE POLICY "artist_news_posts: artist insert own" ON public.artist_news_posts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_news_posts.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "artist_news_posts: artist update own" ON public.artist_news_posts;
CREATE POLICY "artist_news_posts: artist update own" ON public.artist_news_posts
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_news_posts.artist_id AND am.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_news_posts.artist_id AND am.user_id = auth.uid()));

DROP POLICY IF EXISTS "artist_news_posts: artist delete own" ON public.artist_news_posts;
CREATE POLICY "artist_news_posts: artist delete own" ON public.artist_news_posts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_news_posts.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "artists: artist read own" ON public.artists;
CREATE POLICY "artists: artist read own" ON public.artists
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am
            WHERE am.artist_id = artists.id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "artists: own artist update" ON public.artists;
CREATE POLICY "artists: own artist update" ON public.artists
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.artist_members am
            WHERE am.artist_id = artists.id AND am.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am
            WHERE am.artist_id = artists.id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "concerts: artist own insert" ON public.concerts;
CREATE POLICY "concerts: artist own insert" ON public.concerts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = concerts.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "concerts: artist own update" ON public.concerts;
CREATE POLICY "concerts: artist own update" ON public.concerts
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = concerts.artist_id AND am.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = concerts.artist_id AND am.user_id = auth.uid()));

DROP POLICY IF EXISTS "concerts: artist own delete" ON public.concerts;
CREATE POLICY "concerts: artist own delete" ON public.concerts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = concerts.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "artist_epks: artist read own" ON public.artist_epks;
CREATE POLICY "artist_epks: artist read own" ON public.artist_epks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_epks.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "artist_epks: artist insert own" ON public.artist_epks;
CREATE POLICY "artist_epks: artist insert own" ON public.artist_epks
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_epks.artist_id AND am.user_id = auth.uid()));

DROP POLICY IF EXISTS "artist_epks: artist update own" ON public.artist_epks;
CREATE POLICY "artist_epks: artist update own" ON public.artist_epks
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_epks.artist_id AND am.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_epks.artist_id AND am.user_id = auth.uid()));

DROP POLICY IF EXISTS "epk_versions: artist read own" ON public.epk_versions;
CREATE POLICY "epk_versions: artist read own" ON public.epk_versions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_versions.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "epk_versions: artist insert own" ON public.epk_versions;
CREATE POLICY "epk_versions: artist insert own" ON public.epk_versions
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_versions.artist_id AND am.user_id = auth.uid()));

DROP POLICY IF EXISTS "artist_landing_pages: artist read own" ON public.artist_landing_pages;
CREATE POLICY "artist_landing_pages: artist read own" ON public.artist_landing_pages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_landing_pages.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "artist_landing_pages: artist insert own" ON public.artist_landing_pages;
CREATE POLICY "artist_landing_pages: artist insert own" ON public.artist_landing_pages
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_landing_pages.artist_id AND am.user_id = auth.uid()));

DROP POLICY IF EXISTS "artist_landing_pages: artist update own" ON public.artist_landing_pages;
CREATE POLICY "artist_landing_pages: artist update own" ON public.artist_landing_pages
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_landing_pages.artist_id AND am.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_landing_pages.artist_id AND am.user_id = auth.uid()));

DROP POLICY IF EXISTS "epk_fonts: artist read own" ON public.epk_fonts;
CREATE POLICY "epk_fonts: artist read own" ON public.epk_fonts
  FOR SELECT USING (
    artist_id IS NULL
    OR EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_fonts.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "epk_fonts: artist insert own" ON public.epk_fonts;
CREATE POLICY "epk_fonts: artist insert own" ON public.epk_fonts
  FOR INSERT
  WITH CHECK (
    artist_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_fonts.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "epk_fonts: artist delete own" ON public.epk_fonts;
CREATE POLICY "epk_fonts: artist delete own" ON public.epk_fonts
  FOR DELETE USING (
    artist_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_fonts.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "epk_share_links: artist read own" ON public.epk_share_links;
CREATE POLICY "epk_share_links: artist read own" ON public.epk_share_links
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_share_links.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "epk_share_links: artist insert own" ON public.epk_share_links;
CREATE POLICY "epk_share_links: artist insert own" ON public.epk_share_links
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_share_links.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "epk_share_links: artist update own" ON public.epk_share_links;
CREATE POLICY "epk_share_links: artist update own" ON public.epk_share_links
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_share_links.artist_id AND am.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_share_links.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "epk_download_events: artist read own" ON public.epk_download_events;
CREATE POLICY "epk_download_events: artist read own" ON public.epk_download_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_download_events.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "streaming_stats: artist read own" ON public.streaming_stats;
CREATE POLICY "streaming_stats: artist read own" ON public.streaming_stats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = streaming_stats.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "sales_statements: artist read own" ON public.sales_statements;
CREATE POLICY "sales_statements: artist read own" ON public.sales_statements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = sales_statements.artist_id AND am.user_id = auth.uid())
    AND status IN ('label_approved', 'artist_notified', 'viewed', 'invoiced', 'paid', 'acknowledged')
  );

DROP POLICY IF EXISTS "artist_territory_metrics: artist read own" ON public.artist_territory_metrics;
CREATE POLICY "artist_territory_metrics: artist read own" ON public.artist_territory_metrics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_territory_metrics.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "artist_listener_metrics: artist read own" ON public.artist_listener_metrics;
CREATE POLICY "artist_listener_metrics: artist read own" ON public.artist_listener_metrics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_listener_metrics.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "spotify_track_play_snapshots: artist read own" ON public.spotify_track_play_snapshots;
CREATE POLICY "spotify_track_play_snapshots: artist read own" ON public.spotify_track_play_snapshots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = spotify_track_play_snapshots.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "event_impact: artist read own" ON public.event_impact;
CREATE POLICY "event_impact: artist read own" ON public.event_impact
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = event_impact.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "promo_impact: artist read own" ON public.promo_impact;
CREATE POLICY "promo_impact: artist read own" ON public.promo_impact
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = promo_impact.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "page_events: artist read own" ON public.page_events;
CREATE POLICY "page_events: artist read own" ON public.page_events
  FOR SELECT USING (
    artist_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = page_events.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "merch_orders: artist read own" ON public.merch_orders;
CREATE POLICY "merch_orders: artist read own" ON public.merch_orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = merch_orders.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "release_checklists: artist read own" ON public.release_checklists;
CREATE POLICY "release_checklists: artist read own" ON public.release_checklists
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = release_checklists.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "release_checklists: artist insert own" ON public.release_checklists;
CREATE POLICY "release_checklists: artist insert own" ON public.release_checklists
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = release_checklists.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "release_checklists: artist update own" ON public.release_checklists;
CREATE POLICY "release_checklists: artist update own" ON public.release_checklists
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = release_checklists.artist_id AND am.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = release_checklists.artist_id AND am.user_id = auth.uid()));

DROP POLICY IF EXISTS "label_messages: artist own read" ON public.label_messages;
CREATE POLICY "label_messages: artist own read" ON public.label_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = label_messages.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "releases: artist own read" ON public.releases;
CREATE POLICY "releases: artist own read" ON public.releases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = releases.artist_id
        AND am.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "concerts: artist own read" ON public.concerts;
CREATE POLICY "concerts: artist own read" ON public.concerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = concerts.artist_id
        AND am.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "release_submissions: artist insert own" ON public.release_submissions;
CREATE POLICY "release_submissions: artist insert own" ON public.release_submissions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = release_submissions.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "release_submissions: artist read own" ON public.release_submissions;
CREATE POLICY "release_submissions: artist read own" ON public.release_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = release_submissions.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "video_submissions: artist insert own" ON public.video_submissions;
CREATE POLICY "video_submissions: artist insert own" ON public.video_submissions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = video_submissions.artist_id AND am.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "video_submissions: artist read own" ON public.video_submissions;
CREATE POLICY "video_submissions: artist read own" ON public.video_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = video_submissions.artist_id AND am.user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_role      public.user_role := 'user';
  v_meta_role TEXT;
  v_artist_id UUID;
BEGIN
  v_meta_role := NEW.raw_app_meta_data->>'role';
  IF v_meta_role IN ('admin', 'editor', 'journalist', 'artist', 'user', 'press') THEN
    v_role := v_meta_role::public.user_role;
  END IF;

  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, v_role)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Only trusted server-side invitations may assign an artist membership
  BEGIN
    v_artist_id := (NEW.raw_app_meta_data->>'artist_id')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_artist_id := NULL;
  END;

  IF v_artist_id IS NOT NULL THEN
    UPDATE public.artists
    SET user_id = NEW.id
    WHERE id = v_artist_id AND (user_id IS NULL OR user_id = NEW.id);

    INSERT INTO public.artist_members (user_id, artist_id, member_role)
    VALUES (NEW.id, v_artist_id, 'owner')
    ON CONFLICT (user_id, artist_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_oauth_artist_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- OAuth authenticates an account, not ownership of a roster artist.
  -- Memberships are granted by the authenticated admin invitation workflow.
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_linked_artist_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT artist_id FROM public.artist_members WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_linked_artist_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT artist_id FROM public.artist_members WHERE user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_artist_member(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.artist_members WHERE user_id = p_user_id);
$$;

-- Security boundary: profile updates never change access or account lifecycle.
CREATE OR REPLACE FUNCTION public.guard_profile_access_columns()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND public.get_my_role() IS DISTINCT FROM 'admin'
     AND (to_jsonb(NEW) - ARRAY['full_name','avatar_url','updated_at'])
         IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['full_name','avatar_url','updated_at']) THEN
    RAISE EXCEPTION 'Account access fields require an administrator' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_profile_access_columns ON public.users;
CREATE TRIGGER guard_profile_access_columns BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_access_columns();

-- Do not allow artist members to reassign ownership or publication privileges.
CREATE OR REPLACE FUNCTION public.guard_artist_access_columns()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT public.has_permission('can_manage_artists')
     AND (to_jsonb(NEW) - ARRAY['bio','hometown','genres','website_url','country','founding_year','twitter_url','shop_url','logo_url','smart_links','apple_music_url','spotify_url','instagram_url','facebook_url','youtube_url','bandcamp_url','soundcloud_url','tiktok_url','image_url','image_position_x','image_position_y','image_scale','portal_terms_version','portal_terms_accepted_at','portal_terms_accepted_by','updated_at'])
         IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['bio','hometown','genres','website_url','country','founding_year','twitter_url','shop_url','logo_url','smart_links','apple_music_url','spotify_url','instagram_url','facebook_url','youtube_url','bandcamp_url','soundcloud_url','tiktok_url','image_url','image_position_x','image_position_y','image_scale','portal_terms_version','portal_terms_accepted_at','portal_terms_accepted_by','updated_at']) THEN
    RAISE EXCEPTION 'Artist administrative fields require staff access' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_artist_access_columns ON public.artists;
CREATE TRIGGER guard_artist_access_columns BEFORE UPDATE ON public.artists
FOR EACH ROW EXECUTE FUNCTION public.guard_artist_access_columns();

-- Trigger functions are not RPC endpoints. Service-only RPCs must also revoke
-- explicit grants left over from older deployments, not only inherited PUBLIC.
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature, p.prorettype
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND (p.prorettype='trigger'::regtype OR p.proname IN
      ('create_release_submission_with_tracks','replace_rejected_release_submission_with_tracks','get_assets_storage_stats'))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.signature);
  END LOOP;
END;
$$;

COMMIT;
