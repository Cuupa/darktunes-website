-- Targeted RLS init-plan, trigger search-path and access index improvements.
BEGIN;
SET LOCAL lock_timeout = '2s';
DROP POLICY IF EXISTS "genres_write_admin" ON public.genres;
CREATE POLICY "genres_write_admin" ON public.genres
  FOR ALL USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "artist_private_data: member read" ON public.artist_private_data;
CREATE POLICY "artist_private_data: member read" ON public.artist_private_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = artist_private_data.artist_id AND am.user_id = (SELECT auth.uid())
    )
    OR (SELECT public.get_my_role()) IN ('admin', 'editor')
  );
DROP POLICY IF EXISTS "artist_private_data: member write" ON public.artist_private_data;
CREATE POLICY "artist_private_data: member write" ON public.artist_private_data
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = artist_private_data.artist_id AND am.user_id = (SELECT auth.uid())
    )
    OR (SELECT public.get_my_role()) IN ('admin', 'editor')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = artist_private_data.artist_id AND am.user_id = (SELECT auth.uid())
    )
    OR (SELECT public.get_my_role()) IN ('admin', 'editor')
  );
DROP POLICY IF EXISTS "artist_private_data: admin all" ON public.artist_private_data;
CREATE POLICY "artist_private_data: admin all" ON public.artist_private_data
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "artist_members: own read" ON public.artist_members;
CREATE POLICY "artist_members: own read" ON public.artist_members
  FOR SELECT USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "artist_members: admin all" ON public.artist_members;
CREATE POLICY "artist_members: admin all" ON public.artist_members
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "tour_share_links: artist manage" ON public.tour_share_links;
CREATE POLICY "tour_share_links: artist manage" ON public.tour_share_links
  FOR ALL TO authenticated
  USING (
    artist_id IN (SELECT am.artist_id FROM public.artist_members am WHERE am.user_id = (SELECT auth.uid()))
    OR public.has_permission('can_view_admin_panel')
    OR (SELECT public.get_my_role()) = 'admin'
  )
  WITH CHECK (
    artist_id IN (SELECT am.artist_id FROM public.artist_members am WHERE am.user_id = (SELECT auth.uid()))
    OR public.has_permission('can_view_admin_panel')
    OR (SELECT public.get_my_role()) = 'admin'
  );
DROP POLICY IF EXISTS "tour_share_links: admin all" ON public.tour_share_links;
CREATE POLICY "tour_share_links: admin all" ON public.tour_share_links
  FOR ALL TO authenticated
  USING (public.has_permission('can_view_admin_panel') OR (SELECT public.get_my_role()) = 'admin')
  WITH CHECK (public.has_permission('can_view_admin_panel') OR (SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "tours: artist manage" ON public.tours;
CREATE POLICY "tours: artist manage" ON public.tours
  FOR ALL USING (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
    OR public.user_can_access_tour(id)
  )
  WITH CHECK (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
    OR public.user_can_access_tour(id)
  );
DROP POLICY IF EXISTS "tours: admin all" ON public.tours;
CREATE POLICY "tours: admin all" ON public.tours
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'editor'))
  );
DROP POLICY IF EXISTS "tour_stops: admin all" ON public.tour_stops;
CREATE POLICY "tour_stops: admin all" ON public.tour_stops
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'editor'))
  );
DROP POLICY IF EXISTS "tour_contacts: artist manage" ON public.tour_contacts;
CREATE POLICY "tour_contacts: artist manage" ON public.tour_contacts
  FOR ALL USING (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "tour_contacts: admin all" ON public.tour_contacts;
CREATE POLICY "tour_contacts: admin all" ON public.tour_contacts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'editor'))
  );
DROP POLICY IF EXISTS "tour_tasks: artist manage" ON public.tour_tasks;
CREATE POLICY "tour_tasks: artist manage" ON public.tour_tasks
  FOR ALL USING (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
    OR (tour_id IS NOT NULL AND public.user_can_access_tour(tour_id))
  )
  WITH CHECK (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
    OR (tour_id IS NOT NULL AND public.user_can_access_tour(tour_id))
  );
DROP POLICY IF EXISTS "tour_tasks: admin all" ON public.tour_tasks;
CREATE POLICY "tour_tasks: admin all" ON public.tour_tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'editor'))
  );
DROP POLICY IF EXISTS "tour_crew: admin all" ON public.tour_crew_members;
CREATE POLICY "tour_crew: admin all" ON public.tour_crew_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'editor'))
  );
DROP POLICY IF EXISTS "tour_merch_items: artist manage" ON public.tour_merch_items;
CREATE POLICY "tour_merch_items: artist manage" ON public.tour_merch_items
  FOR ALL USING (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "tour_merch_items: admin all" ON public.tour_merch_items;
CREATE POLICY "tour_merch_items: admin all" ON public.tour_merch_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'editor'))
  );
DROP POLICY IF EXISTS "tour_merch_settlements: artist manage" ON public.tour_merch_settlements;
CREATE POLICY "tour_merch_settlements: artist manage" ON public.tour_merch_settlements
  FOR ALL USING (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "tour_merch_settlements: admin all" ON public.tour_merch_settlements;
CREATE POLICY "tour_merch_settlements: admin all" ON public.tour_merch_settlements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'editor'))
  );
DROP POLICY IF EXISTS "tour_stop_artist_private: own artist" ON public.tour_stop_artist_private;
CREATE POLICY "tour_stop_artist_private: own artist" ON public.tour_stop_artist_private
  FOR ALL USING (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.tour_stops ts
      WHERE ts.id = stop_id AND public.user_can_access_tour(ts.tour_id)
    )
  )
  WITH CHECK (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.tour_stops ts
      WHERE ts.id = stop_id AND public.user_can_access_tour(ts.tour_id)
    )
  );
DROP POLICY IF EXISTS "tour_artist_finance: own artist" ON public.tour_artist_finance;
CREATE POLICY "tour_artist_finance: own artist" ON public.tour_artist_finance
  FOR ALL USING (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
    AND public.user_can_access_tour(tour_id)
  )
  WITH CHECK (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
    AND public.user_can_access_tour(tour_id)
  );
DROP POLICY IF EXISTS "tour_collaborators: admin all" ON public.tour_collaborators;
CREATE POLICY "tour_collaborators: admin all" ON public.tour_collaborators
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'editor'))
  );
DROP POLICY IF EXISTS "tour_stop_performing_artists: admin all" ON public.tour_stop_performing_artists;
CREATE POLICY "tour_stop_performing_artists: admin all" ON public.tour_stop_performing_artists
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'editor'))
  );
DROP POLICY IF EXISTS "tour_stop_artist_private: admin all" ON public.tour_stop_artist_private;
CREATE POLICY "tour_stop_artist_private: admin all" ON public.tour_stop_artist_private
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'editor'))
  );
DROP POLICY IF EXISTS "tour_artist_finance: admin all" ON public.tour_artist_finance;
CREATE POLICY "tour_artist_finance: admin all" ON public.tour_artist_finance
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'editor'))
  );
DROP POLICY IF EXISTS "concert_artists: artist manage" ON public.concert_artists;
CREATE POLICY "concert_artists: artist manage" ON public.concert_artists
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.concerts c
      JOIN public.artist_members am ON am.artist_id = c.artist_id
      WHERE c.id = concert_id AND am.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.concerts c
      JOIN public.artist_members am ON am.artist_id = c.artist_id
      WHERE c.id = concert_id AND am.user_id = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "concert_artists: admin all" ON public.concert_artists;
CREATE POLICY "concert_artists: admin all" ON public.concert_artists
  FOR ALL USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "artist_news_posts: artist read own" ON public.artist_news_posts;
CREATE POLICY "artist_news_posts: artist read own" ON public.artist_news_posts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_news_posts.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "artist_news_posts: artist insert own" ON public.artist_news_posts;
CREATE POLICY "artist_news_posts: artist insert own" ON public.artist_news_posts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_news_posts.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "artist_news_posts: artist update own" ON public.artist_news_posts;
CREATE POLICY "artist_news_posts: artist update own" ON public.artist_news_posts
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_news_posts.artist_id AND am.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_news_posts.artist_id AND am.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "artist_news_posts: artist delete own" ON public.artist_news_posts;
CREATE POLICY "artist_news_posts: artist delete own" ON public.artist_news_posts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_news_posts.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "artist_news_posts: admin all" ON public.artist_news_posts;
CREATE POLICY "artist_news_posts: admin all" ON public.artist_news_posts
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "artist_news_posts: editor+ read all" ON public.artist_news_posts;
CREATE POLICY "artist_news_posts: editor+ read all" ON public.artist_news_posts
  FOR SELECT USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "sync_queue: admin all" ON public.sync_queue;
CREATE POLICY "sync_queue: admin all" ON public.sync_queue
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "cron_ticks: admin read" ON public.cron_ticks;
CREATE POLICY "cron_ticks: admin read" ON public.cron_ticks
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "sync_runs: admin read" ON public.sync_runs;
CREATE POLICY "sync_runs: admin read" ON public.sync_runs
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "sync_worker_lease: admin read" ON public.sync_worker_lease;
CREATE POLICY "sync_worker_lease: admin read" ON public.sync_worker_lease
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "users: own read" ON public.users;
CREATE POLICY "users: own read" ON public.users
  FOR SELECT USING ((SELECT auth.uid()) = id);
DROP POLICY IF EXISTS "users: own update" ON public.users;
CREATE POLICY "users: own update" ON public.users
  FOR UPDATE USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);
DROP POLICY IF EXISTS "users: admin read all" ON public.users;
CREATE POLICY "users: admin read all" ON public.users
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "users: admin update all" ON public.users;
CREATE POLICY "users: admin update all" ON public.users
  FOR UPDATE USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "role_permissions: admin update" ON public.role_permissions;
CREATE POLICY "role_permissions: admin update" ON public.role_permissions
  FOR UPDATE USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "artists: public read visible" ON public.artists;
CREATE POLICY "artists: public read visible" ON public.artists
  FOR SELECT USING (
    is_visible = TRUE
    OR (SELECT public.get_my_role()) IN ('admin', 'editor')
  );
DROP POLICY IF EXISTS "artists: artist read own" ON public.artists;
CREATE POLICY "artists: artist read own" ON public.artists
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am
            WHERE am.artist_id = artists.id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "artists: can_manage_artists insert" ON public.artists;
CREATE POLICY "artists: can_manage_artists insert" ON public.artists
  FOR INSERT WITH CHECK (
    public.has_permission('can_manage_artists') OR (SELECT public.get_my_role()) = 'admin'
  );
DROP POLICY IF EXISTS "artists: can_manage_artists update" ON public.artists;
CREATE POLICY "artists: can_manage_artists update" ON public.artists
  FOR UPDATE USING (
    public.has_permission('can_manage_artists') OR (SELECT public.get_my_role()) = 'admin'
  ) WITH CHECK (
    public.has_permission('can_manage_artists') OR (SELECT public.get_my_role()) = 'admin'
  );
DROP POLICY IF EXISTS "artists: admin delete" ON public.artists;
CREATE POLICY "artists: admin delete" ON public.artists
  FOR DELETE USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "artists: own artist update" ON public.artists;
CREATE POLICY "artists: own artist update" ON public.artists
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.artist_members am
            WHERE am.artist_id = artists.id AND am.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am
            WHERE am.artist_id = artists.id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "releases: public read visible" ON public.releases;
CREATE POLICY "releases: public read visible" ON public.releases
  FOR SELECT USING (
    (
      is_visible = TRUE
      AND (
        artist_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.artists a
          WHERE a.id = artist_id AND a.is_visible = TRUE
        )
      )
    )
    OR (SELECT public.get_my_role()) IN ('admin', 'editor')
  );
DROP POLICY IF EXISTS "releases: can_manage_releases insert" ON public.releases;
CREATE POLICY "releases: can_manage_releases insert" ON public.releases
  FOR INSERT WITH CHECK (
    public.has_permission('can_manage_releases') OR (SELECT public.get_my_role()) = 'admin'
  );
DROP POLICY IF EXISTS "releases: can_manage_releases update" ON public.releases;
CREATE POLICY "releases: can_manage_releases update" ON public.releases
  FOR UPDATE USING (
    public.has_permission('can_manage_releases') OR (SELECT public.get_my_role()) = 'admin'
  ) WITH CHECK (
    public.has_permission('can_manage_releases') OR (SELECT public.get_my_role()) = 'admin'
  );
DROP POLICY IF EXISTS "releases: admin delete" ON public.releases;
CREATE POLICY "releases: admin delete" ON public.releases
  FOR DELETE USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "news_posts: public read" ON public.news_posts;
CREATE POLICY "news_posts: public read" ON public.news_posts
  FOR SELECT USING (
    (
      status IN ('published', 'scheduled')
      AND published_at <= NOW()
      AND is_press_only = false
    )
    OR public.has_permission('can_edit_news')
    OR public.has_permission('can_publish_news')
    OR (SELECT public.get_my_role()) IN ('admin', 'editor', 'journalist')
  );
DROP POLICY IF EXISTS "news_posts: can_publish_news insert" ON public.news_posts;
CREATE POLICY "news_posts: can_publish_news insert" ON public.news_posts
  FOR INSERT WITH CHECK (
    public.has_permission('can_publish_news') OR (SELECT public.get_my_role()) = 'admin'
  );
DROP POLICY IF EXISTS "news_posts: can_edit_news update" ON public.news_posts;
CREATE POLICY "news_posts: can_edit_news update" ON public.news_posts
  FOR UPDATE USING (
    public.has_permission('can_edit_news') OR (SELECT public.get_my_role()) = 'admin'
  ) WITH CHECK (
    public.has_permission('can_edit_news') OR (SELECT public.get_my_role()) = 'admin'
  );
DROP POLICY IF EXISTS "news_posts: admin delete" ON public.news_posts;
CREATE POLICY "news_posts: admin delete" ON public.news_posts
  FOR DELETE USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "videos: public read" ON public.videos;
CREATE POLICY "videos: public read" ON public.videos
  FOR SELECT USING (
    is_visible = TRUE
    OR (SELECT public.get_my_role()) IN ('admin', 'editor')
  );
DROP POLICY IF EXISTS "videos: can_manage_videos insert" ON public.videos;
CREATE POLICY "videos: can_manage_videos insert" ON public.videos
  FOR INSERT WITH CHECK (
    public.has_permission('can_manage_videos') OR (SELECT public.get_my_role()) = 'admin'
  );
DROP POLICY IF EXISTS "videos: can_manage_videos update" ON public.videos;
CREATE POLICY "videos: can_manage_videos update" ON public.videos
  FOR UPDATE USING (
    public.has_permission('can_manage_videos') OR (SELECT public.get_my_role()) = 'admin'
  ) WITH CHECK (
    public.has_permission('can_manage_videos') OR (SELECT public.get_my_role()) = 'admin'
  );
DROP POLICY IF EXISTS "videos: admin delete" ON public.videos;
CREATE POLICY "videos: admin delete" ON public.videos
  FOR DELETE USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "assets: staff read" ON public.assets;
CREATE POLICY "assets: staff read" ON public.assets
  FOR SELECT USING (
    public.has_permission('can_view_admin_panel')
    OR (SELECT public.get_my_role()) IN ('admin', 'editor')
  );
DROP POLICY IF EXISTS "assets: can_view_admin_panel insert" ON public.assets;
CREATE POLICY "assets: can_view_admin_panel insert" ON public.assets
  FOR INSERT WITH CHECK (
    public.has_permission('can_view_admin_panel') OR (SELECT public.get_my_role()) = 'admin'
  );
DROP POLICY IF EXISTS "assets: can_view_admin_panel update" ON public.assets;
CREATE POLICY "assets: can_view_admin_panel update" ON public.assets
  FOR UPDATE USING (
    public.has_permission('can_view_admin_panel') OR (SELECT public.get_my_role()) = 'admin'
  ) WITH CHECK (
    public.has_permission('can_view_admin_panel') OR (SELECT public.get_my_role()) = 'admin'
  );
DROP POLICY IF EXISTS "assets: admin delete" ON public.assets;
CREATE POLICY "assets: admin delete" ON public.assets
  FOR DELETE USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "asset_folders: staff read" ON public.asset_folders;
CREATE POLICY "asset_folders: staff read" ON public.asset_folders
  FOR SELECT TO authenticated
  USING (
    public.has_permission('can_view_admin_panel')
    OR (SELECT public.get_my_role()) IN ('admin', 'editor')
  );
DROP POLICY IF EXISTS "asset_folders: can_view_admin_panel write" ON public.asset_folders;
CREATE POLICY "asset_folders: can_view_admin_panel write"  ON public.asset_folders FOR INSERT TO authenticated WITH CHECK (
  public.has_permission('can_view_admin_panel') OR (SELECT public.get_my_role()) = 'admin'
);
DROP POLICY IF EXISTS "asset_folders: admin delete" ON public.asset_folders;
CREATE POLICY "asset_folders: admin delete"                ON public.asset_folders FOR DELETE TO authenticated USING (
  (SELECT public.get_my_role()) = 'admin'
);
DROP POLICY IF EXISTS "asset_folders: can_view_admin_panel update" ON public.asset_folders;
CREATE POLICY "asset_folders: can_view_admin_panel update" ON public.asset_folders FOR UPDATE TO authenticated USING (
  public.has_permission('can_view_admin_panel') OR (SELECT public.get_my_role()) = 'admin'
);
DROP POLICY IF EXISTS "asset_artists: editor+ write" ON public.asset_artists;
CREATE POLICY "asset_artists: editor+ write" ON public.asset_artists
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin','editor'))
  );
DROP POLICY IF EXISTS "asset_artists: editor+ delete" ON public.asset_artists;
CREATE POLICY "asset_artists: editor+ delete" ON public.asset_artists
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin','editor'))
  );
DROP POLICY IF EXISTS "site_settings_public_read" ON public.site_settings;
CREATE POLICY "site_settings_public_read" ON public.site_settings
  FOR SELECT USING (
    (SELECT public.get_my_role()) IN ('admin', 'editor')
    OR key = ANY (ARRAY[
      'label_name',
      'label_short_name',
      'label_tagline',
      'contact_email',
      'privacy_policy_url',
      'terms_url',
      'instagram_url',
      'youtube_url',
      'spotify_url',
      'spotify_playlist_uri',
      'spotify_playlists',
      'hero_badge',
      'hero_news_badge',
      'hero_description',
      'hero_content_type',
      'hero_featured_id',
      'hero_custom_bg_url',
      'hero_default_primary_btn_label',
      'hero_default_secondary_btn_label',
      'seo_title',
      'seo_description',
      'og_title',
      'og_description',
      'impressum_company_name',
      'impressum_legal_form',
      'impressum_representative',
      'impressum_address',
      'impressum_vat_id',
      'impressum_register_court',
      'impressum_register_number',
      'impressum_phone',
      'impressum_email',
      'datenschutz_content',
      'datenschutz_content_en',
      'agb_content',
      'agb_content_en',
      'portal_terms_version',
      'consent_placeholder_url',
      'noise_opacity',
      'crt_scanlines_enabled',
      'vignette_intensity',
      'shopify_store_url',
      'submit_hub_url',
      'submit_hub_label',
      'submit_hub_description',
      'submit_hub_section_heading',
      'show_about_in_header',
      'show_about_in_footer',
      'about_nav_label',
      'youtube_channel_id',
      'carousel_autoplay_ms',
      'videos_per_page',
      'videos_link_to_page',
      'exclude_shorts_from_public',
      'artist_profile_video_rows',
      'artist_profile_news_rows',
      'concerts_per_page',
      'concerts_link_to_page',
      'feature_toggles',
      'logo_url',
      'favicon_url',
      'about_headline',
      'about_subheading',
      'about_body',
      'newsletter_heading',
      'newsletter_description',
      'spotify_section_heading',
      'spotify_section_subheading',
      'videos_section_heading',
      'videos_section_subheading',
      'news_section_heading',
      'news_section_subheading',
      'concerts_section_heading',
      'concerts_section_subheading',
      'releases_section_heading',
      'releases_section_subheading',
      'homepage_section_order',
      'homepage_news_count',
      'contact_topics',
      'custom_social_links',
      'theme_primary',
      'theme_secondary',
      'theme_background',
      'theme_foreground',
      'theme_card',
      'theme_muted',
      'theme_accent',
      'theme_border',
      'theme_gradient_hero_from',
      'theme_gradient_hero_to',
      'theme_gradient_hero_dir',
      'theme_gradient_accent_from',
      'theme_gradient_accent_to',
      'theme_gradient_accent_dir',
      'theme_config'
    ]::text[])
  );
DROP POLICY IF EXISTS "site_settings_admin_write" ON public.site_settings;
CREATE POLICY "site_settings_admin_write" ON public.site_settings
  FOR ALL
  USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "api_credentials_admin_only" ON public.api_credentials;
CREATE POLICY "api_credentials_admin_only" ON public.api_credentials
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "sync_logs: editor+ read" ON public.sync_logs;
CREATE POLICY "sync_logs: editor+ read" ON public.sync_logs
  FOR SELECT USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "app_logs: admin read" ON public.app_logs;
CREATE POLICY "app_logs: admin read" ON public.app_logs
  FOR SELECT USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "support_known_errors: admin read" ON public.support_known_errors;
CREATE POLICY "support_known_errors: admin read" ON public.support_known_errors
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "support_known_errors: admin write" ON public.support_known_errors;
CREATE POLICY "support_known_errors: admin write" ON public.support_known_errors
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "zammad_ticket_log: admin read" ON public.zammad_ticket_log;
CREATE POLICY "zammad_ticket_log: admin read" ON public.zammad_ticket_log
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "ai_conversations: owner read" ON public.ai_conversations;
CREATE POLICY "ai_conversations: owner read" ON public.ai_conversations
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR (SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "ai_messages: owner read" ON public.ai_messages;
CREATE POLICY "ai_messages: owner read" ON public.ai_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = conversation_id
        AND (c.user_id = (SELECT auth.uid()) OR (SELECT public.get_my_role()) = 'admin')
    )
  );
DROP POLICY IF EXISTS "ai_usage_events: owner read" ON public.ai_usage_events;
CREATE POLICY "ai_usage_events: owner read" ON public.ai_usage_events
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR (SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "ai_diagnostics: owner read" ON public.ai_diagnostics;
CREATE POLICY "ai_diagnostics: owner read" ON public.ai_diagnostics
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR (SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "ai_settings: admin read" ON public.ai_settings;
CREATE POLICY "ai_settings: admin read" ON public.ai_settings
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "ai_token_budgets: admin read" ON public.ai_token_budgets;
CREATE POLICY "ai_token_budgets: admin read" ON public.ai_token_budgets
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "concerts: public read visible" ON public.concerts;
CREATE POLICY "concerts: public read visible" ON public.concerts
  FOR SELECT USING (
    artist_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id AND a.is_visible = TRUE
    )
    OR (SELECT public.get_my_role()) IN ('admin', 'editor')
  );
DROP POLICY IF EXISTS "Allow admin inserts on concerts" ON public.concerts;
CREATE POLICY "Allow admin inserts on concerts" ON public.concerts
  FOR INSERT WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "Allow admin updates on concerts" ON public.concerts;
CREATE POLICY "Allow admin updates on concerts" ON public.concerts
  FOR UPDATE USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "Allow admin deletes on concerts" ON public.concerts;
CREATE POLICY "Allow admin deletes on concerts" ON public.concerts
  FOR DELETE USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "concerts: artist own insert" ON public.concerts;
CREATE POLICY "concerts: artist own insert" ON public.concerts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = concerts.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "concerts: artist own update" ON public.concerts;
CREATE POLICY "concerts: artist own update" ON public.concerts
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = concerts.artist_id AND am.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = concerts.artist_id AND am.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "concerts: artist own delete" ON public.concerts;
CREATE POLICY "concerts: artist own delete" ON public.concerts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = concerts.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "concerts: artist manage own" ON public.concerts;
CREATE POLICY "concerts: artist manage own" ON public.concerts
  FOR ALL USING (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "editor_activity_log: admin read" ON public.editor_activity_log;
CREATE POLICY "editor_activity_log: admin read" ON public.editor_activity_log
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "editor_activity_log: editor read own" ON public.editor_activity_log;
CREATE POLICY "editor_activity_log: editor read own" ON public.editor_activity_log
  FOR SELECT USING ((SELECT public.get_my_role()) = 'editor' AND editor_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "editor_activity_log: editor insert own" ON public.editor_activity_log;
CREATE POLICY "editor_activity_log: editor insert own" ON public.editor_activity_log
  FOR INSERT WITH CHECK (
    (SELECT public.get_my_role()) = 'editor' AND editor_id = (SELECT auth.uid())
  );
DROP POLICY IF EXISTS "editor_notifications: editor read own" ON public.editor_notifications;
CREATE POLICY "editor_notifications: editor read own" ON public.editor_notifications
  FOR SELECT USING (
    (SELECT public.get_my_role()) = 'editor' AND recipient_id = (SELECT auth.uid())
  );
DROP POLICY IF EXISTS "editor_notifications: editor update own" ON public.editor_notifications;
CREATE POLICY "editor_notifications: editor update own" ON public.editor_notifications
  FOR UPDATE USING (
    (SELECT public.get_my_role()) = 'editor' AND recipient_id = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT public.get_my_role()) = 'editor' AND recipient_id = (SELECT auth.uid())
  );
DROP POLICY IF EXISTS "editor_notifications: admin manage" ON public.editor_notifications;
CREATE POLICY "editor_notifications: admin manage" ON public.editor_notifications
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "notifications: own read" ON public.notifications;
CREATE POLICY "notifications: own read" ON public.notifications
  FOR SELECT USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "notifications: own update" ON public.notifications;
CREATE POLICY "notifications: own update" ON public.notifications
  FOR UPDATE USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "notifications: admin read all" ON public.notifications;
CREATE POLICY "notifications: admin read all" ON public.notifications
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "notification_preferences: own all" ON public.notification_preferences;
CREATE POLICY "notification_preferences: own all" ON public.notification_preferences
  FOR ALL USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "push_subscriptions: own all" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions: own all" ON public.push_subscriptions
  FOR ALL USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "interview_requests: journalist manage own" ON public.interview_requests;
CREATE POLICY "interview_requests: journalist manage own" ON public.interview_requests
  FOR ALL USING (journalist_id = (SELECT auth.uid()))
  WITH CHECK (journalist_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "interview_requests: artist read own" ON public.interview_requests;
CREATE POLICY "interview_requests: artist read own" ON public.interview_requests
  FOR SELECT USING (artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "interview_requests: artist update own" ON public.interview_requests;
CREATE POLICY "interview_requests: artist update own" ON public.interview_requests
  FOR UPDATE USING (artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "interview_requests: artist delete own" ON public.interview_requests;
CREATE POLICY "interview_requests: artist delete own" ON public.interview_requests
  FOR DELETE USING (artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "artist_epks: artist read own" ON public.artist_epks;
CREATE POLICY "artist_epks: artist read own" ON public.artist_epks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_epks.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "artist_epks: artist insert own" ON public.artist_epks;
CREATE POLICY "artist_epks: artist insert own" ON public.artist_epks
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_epks.artist_id AND am.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "artist_epks: artist update own" ON public.artist_epks;
CREATE POLICY "artist_epks: artist update own" ON public.artist_epks
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_epks.artist_id AND am.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_epks.artist_id AND am.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "artist_epks: admin all" ON public.artist_epks;
CREATE POLICY "artist_epks: admin all" ON public.artist_epks
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "epk_versions: artist read own" ON public.epk_versions;
CREATE POLICY "epk_versions: artist read own" ON public.epk_versions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_versions.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "epk_versions: artist insert own" ON public.epk_versions;
CREATE POLICY "epk_versions: artist insert own" ON public.epk_versions
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_versions.artist_id AND am.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "epk_versions: admin all" ON public.epk_versions;
CREATE POLICY "epk_versions: admin all" ON public.epk_versions
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "artist_landing_pages: artist read own" ON public.artist_landing_pages;
CREATE POLICY "artist_landing_pages: artist read own" ON public.artist_landing_pages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_landing_pages.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "artist_landing_pages: artist insert own" ON public.artist_landing_pages;
CREATE POLICY "artist_landing_pages: artist insert own" ON public.artist_landing_pages
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_landing_pages.artist_id AND am.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "artist_landing_pages: artist update own" ON public.artist_landing_pages;
CREATE POLICY "artist_landing_pages: artist update own" ON public.artist_landing_pages
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_landing_pages.artist_id AND am.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_landing_pages.artist_id AND am.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "artist_landing_pages: admin all" ON public.artist_landing_pages;
CREATE POLICY "artist_landing_pages: admin all" ON public.artist_landing_pages
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "artist_landing_pages: editor+ read all" ON public.artist_landing_pages;
CREATE POLICY "artist_landing_pages: editor+ read all" ON public.artist_landing_pages
  FOR SELECT USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "artist_landing_pages: editor+ update" ON public.artist_landing_pages;
CREATE POLICY "artist_landing_pages: editor+ update" ON public.artist_landing_pages
  FOR UPDATE USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "epk_fonts: artist read own" ON public.epk_fonts;
CREATE POLICY "epk_fonts: artist read own" ON public.epk_fonts
  FOR SELECT USING (
    artist_id IS NULL
    OR EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_fonts.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "epk_fonts: artist insert own" ON public.epk_fonts;
CREATE POLICY "epk_fonts: artist insert own" ON public.epk_fonts
  FOR INSERT
  WITH CHECK (
    artist_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_fonts.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "epk_fonts: artist delete own" ON public.epk_fonts;
CREATE POLICY "epk_fonts: artist delete own" ON public.epk_fonts
  FOR DELETE USING (
    artist_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_fonts.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "epk_fonts: admin all" ON public.epk_fonts;
CREATE POLICY "epk_fonts: admin all" ON public.epk_fonts
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "epk_share_links: artist read own" ON public.epk_share_links;
CREATE POLICY "epk_share_links: artist read own" ON public.epk_share_links
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_share_links.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "epk_share_links: artist insert own" ON public.epk_share_links;
CREATE POLICY "epk_share_links: artist insert own" ON public.epk_share_links
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_share_links.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "epk_share_links: artist update own" ON public.epk_share_links;
CREATE POLICY "epk_share_links: artist update own" ON public.epk_share_links
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_share_links.artist_id AND am.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_share_links.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "epk_share_links: admin all" ON public.epk_share_links;
CREATE POLICY "epk_share_links: admin all" ON public.epk_share_links
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "epk_download_events: artist read own" ON public.epk_download_events;
CREATE POLICY "epk_download_events: artist read own" ON public.epk_download_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = epk_download_events.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "epk_download_events: admin all" ON public.epk_download_events;
CREATE POLICY "epk_download_events: admin all" ON public.epk_download_events
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "epk_templates: read published" ON public.epk_templates;
CREATE POLICY "epk_templates: read published" ON public.epk_templates
  FOR SELECT USING (
    (is_published = TRUE AND (SELECT auth.uid()) IS NOT NULL)
    OR (SELECT public.get_my_role()) IN ('admin', 'editor')
  );
DROP POLICY IF EXISTS "epk_templates: admin all" ON public.epk_templates;
CREATE POLICY "epk_templates: admin all" ON public.epk_templates
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "streaming_stats: artist read own" ON public.streaming_stats;
CREATE POLICY "streaming_stats: artist read own" ON public.streaming_stats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = streaming_stats.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "streaming_stats: admin all" ON public.streaming_stats;
CREATE POLICY "streaming_stats: admin all" ON public.streaming_stats
  FOR ALL
  USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "sales_statements: artist read own" ON public.sales_statements;
CREATE POLICY "sales_statements: artist read own" ON public.sales_statements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = sales_statements.artist_id AND am.user_id = (SELECT auth.uid()))
    AND status IN ('label_approved', 'artist_notified', 'viewed', 'invoiced', 'paid', 'acknowledged')
  );
DROP POLICY IF EXISTS "sales_statements: admin all" ON public.sales_statements;
CREATE POLICY "sales_statements: admin all" ON public.sales_statements
  FOR ALL
  USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "distributor_import_batches: admin all" ON public.distributor_import_batches;
CREATE POLICY "distributor_import_batches: admin all" ON public.distributor_import_batches
  FOR ALL
  USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "distributor_import_batches: artist read linked" ON public.distributor_import_batches;
CREATE POLICY "distributor_import_batches: artist read linked" ON public.distributor_import_batches
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.sales_statements ss
      WHERE ss.batch_id = distributor_import_batches.id
        AND ss.status IN ('label_approved', 'artist_notified', 'viewed', 'invoiced', 'paid', 'acknowledged')
        AND EXISTS (
          SELECT 1 FROM public.artist_members am
          WHERE am.artist_id = ss.artist_id AND am.user_id = (SELECT auth.uid())
        )
    )
  );
DROP POLICY IF EXISTS "artist_territory_metrics: artist read own" ON public.artist_territory_metrics;
CREATE POLICY "artist_territory_metrics: artist read own" ON public.artist_territory_metrics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_territory_metrics.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "artist_territory_metrics: admin all" ON public.artist_territory_metrics;
CREATE POLICY "artist_territory_metrics: admin all" ON public.artist_territory_metrics
  FOR ALL
  USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "artist_listener_metrics: artist read own" ON public.artist_listener_metrics;
CREATE POLICY "artist_listener_metrics: artist read own" ON public.artist_listener_metrics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = artist_listener_metrics.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "artist_listener_metrics: admin all" ON public.artist_listener_metrics;
CREATE POLICY "artist_listener_metrics: admin all" ON public.artist_listener_metrics
  FOR ALL
  USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "spotify_track_play_snapshots: artist read own" ON public.spotify_track_play_snapshots;
CREATE POLICY "spotify_track_play_snapshots: artist read own" ON public.spotify_track_play_snapshots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = spotify_track_play_snapshots.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "spotify_track_play_snapshots: admin all" ON public.spotify_track_play_snapshots;
CREATE POLICY "spotify_track_play_snapshots: admin all" ON public.spotify_track_play_snapshots
  FOR ALL
  USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "apify_usage_months: admin all" ON public.apify_usage_months;
CREATE POLICY "apify_usage_months: admin all" ON public.apify_usage_months
  FOR ALL
  USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "sales_statement_line_items: artist read own" ON public.sales_statement_line_items;
CREATE POLICY "sales_statement_line_items: artist read own" ON public.sales_statement_line_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sales_statements ss
      JOIN public.artist_members am ON am.artist_id = ss.artist_id
      WHERE ss.id = statement_id
        AND am.user_id = (SELECT auth.uid())
        AND ss.status IN ('label_approved', 'artist_notified', 'viewed', 'invoiced', 'paid', 'acknowledged')
    )
  );
DROP POLICY IF EXISTS "sales_statement_line_items: admin all" ON public.sales_statement_line_items;
CREATE POLICY "sales_statement_line_items: admin all" ON public.sales_statement_line_items
  FOR ALL
  USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "event_impact: artist read own" ON public.event_impact;
CREATE POLICY "event_impact: artist read own" ON public.event_impact
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = event_impact.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "event_impact: admin all" ON public.event_impact;
CREATE POLICY "event_impact: admin all" ON public.event_impact
  FOR ALL
  USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "promo_impact: artist read own" ON public.promo_impact;
CREATE POLICY "promo_impact: artist read own" ON public.promo_impact
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = promo_impact.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "promo_impact: admin all" ON public.promo_impact;
CREATE POLICY "promo_impact: admin all" ON public.promo_impact
  FOR ALL
  USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "page_events: artist read own" ON public.page_events;
CREATE POLICY "page_events: artist read own" ON public.page_events
  FOR SELECT USING (
    artist_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = page_events.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "page_events: admin all" ON public.page_events;
CREATE POLICY "page_events: admin all" ON public.page_events
  FOR ALL
  USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "merch_orders: artist read own" ON public.merch_orders;
CREATE POLICY "merch_orders: artist read own" ON public.merch_orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = merch_orders.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "merch_orders: admin all" ON public.merch_orders;
CREATE POLICY "merch_orders: admin all" ON public.merch_orders
  FOR ALL
  USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "release_checklists: artist read own" ON public.release_checklists;
CREATE POLICY "release_checklists: artist read own" ON public.release_checklists
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = release_checklists.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "release_checklists: artist insert own" ON public.release_checklists;
CREATE POLICY "release_checklists: artist insert own" ON public.release_checklists
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = release_checklists.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "release_checklists: artist update own" ON public.release_checklists;
CREATE POLICY "release_checklists: artist update own" ON public.release_checklists
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = release_checklists.artist_id AND am.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = release_checklists.artist_id AND am.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "release_checklists: admin all" ON public.release_checklists;
CREATE POLICY "release_checklists: admin all" ON public.release_checklists
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "press_photos: admin all" ON public.press_photos;
CREATE POLICY "press_photos: admin all" ON public.press_photos
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "press_kit_items: can_view_admin_panel insert" ON public.press_kit_items;
CREATE POLICY "press_kit_items: can_view_admin_panel insert" ON public.press_kit_items
  FOR INSERT WITH CHECK (
    public.has_permission('can_view_admin_panel') OR (SELECT public.get_my_role()) = 'admin'
  );
DROP POLICY IF EXISTS "press_kit_items: can_view_admin_panel update" ON public.press_kit_items;
CREATE POLICY "press_kit_items: can_view_admin_panel update" ON public.press_kit_items
  FOR UPDATE USING (
    public.has_permission('can_view_admin_panel') OR (SELECT public.get_my_role()) = 'admin'
  ) WITH CHECK (
    public.has_permission('can_view_admin_panel') OR (SELECT public.get_my_role()) = 'admin'
  );
DROP POLICY IF EXISTS "press_kit_items: can_view_admin_panel delete" ON public.press_kit_items;
CREATE POLICY "press_kit_items: can_view_admin_panel delete" ON public.press_kit_items
  FOR DELETE USING (
    public.has_permission('can_view_admin_panel') OR (SELECT public.get_my_role()) = 'admin'
  );
DROP POLICY IF EXISTS "promo_tracks: journalist read" ON public.promo_tracks;
CREATE POLICY "promo_tracks: journalist read" ON public.promo_tracks
  FOR SELECT USING ((SELECT public.get_my_role()) IN ('journalist', 'admin'));
DROP POLICY IF EXISTS "promo_tracks: admin all" ON public.promo_tracks;
CREATE POLICY "promo_tracks: admin all" ON public.promo_tracks
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "journalist_applications: own read" ON public.journalist_applications;
CREATE POLICY "journalist_applications: own read" ON public.journalist_applications
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "journalist_applications: own insert" ON public.journalist_applications;
CREATE POLICY "journalist_applications: own insert" ON public.journalist_applications
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "journalist_applications: admin all" ON public.journalist_applications;
CREATE POLICY "journalist_applications: admin all" ON public.journalist_applications
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "portal_feature_flags: admin write" ON public.portal_feature_flags;
CREATE POLICY "portal_feature_flags: admin write" ON public.portal_feature_flags
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "label_messages: artist own read" ON public.label_messages;
CREATE POLICY "label_messages: artist own read" ON public.label_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = label_messages.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "label_messages: admin all" ON public.label_messages;
CREATE POLICY "label_messages: admin all" ON public.label_messages
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "message_folders: admin all" ON public.message_folders;
CREATE POLICY "message_folders: admin all" ON public.message_folders
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "message_rules: admin all" ON public.message_rules;
CREATE POLICY "message_rules: admin all" ON public.message_rules
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "message_attachments: artist own read" ON public.message_attachments;
CREATE POLICY "message_attachments: artist own read" ON public.message_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.label_messages lm
      JOIN public.artist_members am ON am.artist_id = lm.artist_id
      WHERE lm.id = message_id AND am.user_id = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "message_attachments: admin all" ON public.message_attachments;
CREATE POLICY "message_attachments: admin all" ON public.message_attachments
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "message_receipts: own all" ON public.message_receipts;
CREATE POLICY "message_receipts: own all" ON public.message_receipts
  FOR ALL USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "message_receipts: admin read" ON public.message_receipts;
CREATE POLICY "message_receipts: admin read" ON public.message_receipts
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "message_internal_notes: admin all" ON public.message_internal_notes;
CREATE POLICY "message_internal_notes: admin all" ON public.message_internal_notes
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "message_internal_notes: editor read write" ON public.message_internal_notes;
CREATE POLICY "message_internal_notes: editor read write" ON public.message_internal_notes
  FOR ALL USING ((SELECT public.get_my_role()) = 'editor')
  WITH CHECK ((SELECT public.get_my_role()) = 'editor');
DROP POLICY IF EXISTS "message_events: admin all" ON public.message_events;
CREATE POLICY "message_events: admin all" ON public.message_events
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "message_events: editor insert read" ON public.message_events;
CREATE POLICY "message_events: editor insert read" ON public.message_events
  FOR ALL USING ((SELECT public.get_my_role()) = 'editor')
  WITH CHECK ((SELECT public.get_my_role()) = 'editor');
DROP POLICY IF EXISTS "journalist_downloads: own read" ON public.journalist_downloads;
CREATE POLICY "journalist_downloads: own read" ON public.journalist_downloads
  FOR SELECT USING (journalist_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "journalist_downloads: own insert" ON public.journalist_downloads;
CREATE POLICY "journalist_downloads: own insert" ON public.journalist_downloads
  FOR INSERT WITH CHECK (journalist_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "journalist_downloads: admin read" ON public.journalist_downloads;
CREATE POLICY "journalist_downloads: admin read" ON public.journalist_downloads
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "accreditation_requests: own read" ON public.accreditation_requests;
CREATE POLICY "accreditation_requests: own read" ON public.accreditation_requests
  FOR SELECT USING (journalist_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "accreditation_requests: own insert" ON public.accreditation_requests;
CREATE POLICY "accreditation_requests: own insert" ON public.accreditation_requests
  FOR INSERT WITH CHECK (journalist_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "accreditation_requests: admin all" ON public.accreditation_requests;
CREATE POLICY "accreditation_requests: admin all" ON public.accreditation_requests
  FOR ALL
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "artist_assets_select_own" ON public.artist_assets;
CREATE POLICY "artist_assets_select_own" ON public.artist_assets
  FOR SELECT USING (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "artist_assets_insert_own" ON public.artist_assets;
CREATE POLICY "artist_assets_insert_own" ON public.artist_assets
  FOR INSERT WITH CHECK (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "artist_assets_delete_own" ON public.artist_assets;
CREATE POLICY "artist_assets_delete_own" ON public.artist_assets
  FOR DELETE USING (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "artist_assets_admin_all" ON public.artist_assets;
CREATE POLICY "artist_assets_admin_all" ON public.artist_assets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
DROP POLICY IF EXISTS "artist_replies_select_own" ON public.artist_replies;
CREATE POLICY "artist_replies_select_own" ON public.artist_replies
  FOR SELECT USING (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "artist_replies_insert_own" ON public.artist_replies;
CREATE POLICY "artist_replies_insert_own" ON public.artist_replies
  FOR INSERT WITH CHECK (
    artist_id IN (SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "artist_replies_admin_all" ON public.artist_replies;
CREATE POLICY "artist_replies_admin_all" ON public.artist_replies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
DROP POLICY IF EXISTS "message_templates: admin all" ON public.message_templates;
CREATE POLICY "message_templates: admin all" ON public.message_templates
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "media_folders: can_view_admin_panel write" ON public.media_folders;
CREATE POLICY "media_folders: can_view_admin_panel write"  ON public.media_folders FOR INSERT TO authenticated WITH CHECK (
  public.has_permission('can_view_admin_panel') OR (SELECT public.get_my_role()) = 'admin'
);
DROP POLICY IF EXISTS "media_folders: admin delete" ON public.media_folders;
CREATE POLICY "media_folders: admin delete"                ON public.media_folders FOR DELETE TO authenticated USING (
  (SELECT public.get_my_role()) = 'admin'
);
DROP POLICY IF EXISTS "media_folders: can_view_admin_panel update" ON public.media_folders;
CREATE POLICY "media_folders: can_view_admin_panel update" ON public.media_folders FOR UPDATE TO authenticated USING (
  public.has_permission('can_view_admin_panel') OR (SELECT public.get_my_role()) = 'admin'
);
DROP POLICY IF EXISTS "media_files: can_view_admin_panel write" ON public.media_files;
CREATE POLICY "media_files: can_view_admin_panel write"  ON public.media_files FOR INSERT TO authenticated WITH CHECK (
  public.has_permission('can_view_admin_panel') OR (SELECT public.get_my_role()) = 'admin'
);
DROP POLICY IF EXISTS "media_files: can_view_admin_panel update" ON public.media_files;
CREATE POLICY "media_files: can_view_admin_panel update" ON public.media_files FOR UPDATE TO authenticated USING (
  public.has_permission('can_view_admin_panel') OR (SELECT public.get_my_role()) = 'admin'
);
DROP POLICY IF EXISTS "media_files: admin delete" ON public.media_files;
CREATE POLICY "media_files: admin delete"                ON public.media_files FOR DELETE TO authenticated USING (
  (SELECT public.get_my_role()) = 'admin'
);
DROP POLICY IF EXISTS "role_changes: admin read" ON public.role_changes;
CREATE POLICY "role_changes: admin read" ON public.role_changes
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "role_changes: admin insert" ON public.role_changes;
CREATE POLICY "role_changes: admin insert" ON public.role_changes
  FOR INSERT WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "ban_history: admin read" ON public.ban_history;
CREATE POLICY "ban_history: admin read" ON public.ban_history
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "ban_history: admin insert" ON public.ban_history;
CREATE POLICY "ban_history: admin insert" ON public.ban_history
  FOR INSERT WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "custom_permission_definitions: admin read" ON public.custom_permission_definitions;
CREATE POLICY "custom_permission_definitions: admin read"  ON public.custom_permission_definitions
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "custom_permission_definitions: admin write" ON public.custom_permission_definitions;
CREATE POLICY "custom_permission_definitions: admin write" ON public.custom_permission_definitions
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "custom_roles: assigned read" ON public.custom_roles;
CREATE POLICY "custom_roles: assigned read" ON public.custom_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_custom_roles ucr
      WHERE ucr.role_id = custom_roles.id
        AND ucr.user_id = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "custom_roles: admin read" ON public.custom_roles;
CREATE POLICY "custom_roles: admin read"  ON public.custom_roles
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "custom_roles: admin write" ON public.custom_roles;
CREATE POLICY "custom_roles: admin write" ON public.custom_roles
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "custom_role_permissions: assigned read" ON public.custom_role_permissions;
CREATE POLICY "custom_role_permissions: assigned read" ON public.custom_role_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_custom_roles ucr
      WHERE ucr.role_id = custom_role_permissions.role_id
        AND ucr.user_id = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "custom_role_permissions: admin read" ON public.custom_role_permissions;
CREATE POLICY "custom_role_permissions: admin read"  ON public.custom_role_permissions
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "custom_role_permissions: admin write" ON public.custom_role_permissions;
CREATE POLICY "custom_role_permissions: admin write" ON public.custom_role_permissions
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "user_custom_roles: own read" ON public.user_custom_roles;
CREATE POLICY "user_custom_roles: own read" ON public.user_custom_roles
  FOR SELECT USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "user_custom_roles: admin read" ON public.user_custom_roles;
CREATE POLICY "user_custom_roles: admin read"  ON public.user_custom_roles
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "user_custom_roles: admin write" ON public.user_custom_roles;
CREATE POLICY "user_custom_roles: admin write" ON public.user_custom_roles
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "rbac_audit_log: admin read" ON public.rbac_audit_log;
CREATE POLICY "rbac_audit_log: admin read"   ON public.rbac_audit_log
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "rbac_audit_log: admin insert" ON public.rbac_audit_log;
CREATE POLICY "rbac_audit_log: admin insert" ON public.rbac_audit_log
  FOR INSERT WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "admin_audit_log: admin read" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log: admin read"   ON public.admin_audit_log
  FOR SELECT USING ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "admin_audit_log: admin insert" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log: admin insert" ON public.admin_audit_log
  FOR INSERT WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "releases: artist own read" ON public.releases;
CREATE POLICY "releases: artist own read" ON public.releases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = releases.artist_id
        AND am.user_id = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "concerts: artist own read" ON public.concerts;
CREATE POLICY "concerts: artist own read" ON public.concerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = concerts.artist_id
        AND am.user_id = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "release_submissions: artist insert own" ON public.release_submissions;
CREATE POLICY "release_submissions: artist insert own" ON public.release_submissions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = release_submissions.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "release_submissions: artist read own" ON public.release_submissions;
CREATE POLICY "release_submissions: artist read own" ON public.release_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = release_submissions.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "release_submissions: editor+ read all" ON public.release_submissions;
CREATE POLICY "release_submissions: editor+ read all" ON public.release_submissions
  FOR SELECT USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "release_submissions: editor+ update" ON public.release_submissions;
CREATE POLICY "release_submissions: editor+ update" ON public.release_submissions
  FOR UPDATE USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "release_submission_assets: editor+ all" ON public.release_submission_assets;
CREATE POLICY "release_submission_assets: editor+ all" ON public.release_submission_assets
  FOR ALL USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "release_submission_tracks: artist insert own" ON public.release_submission_tracks;
CREATE POLICY "release_submission_tracks: artist insert own" ON public.release_submission_tracks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.release_submissions rs
      JOIN public.artist_members am ON am.artist_id = rs.artist_id
      WHERE rs.id = submission_id AND am.user_id = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "release_submission_tracks: artist read own" ON public.release_submission_tracks;
CREATE POLICY "release_submission_tracks: artist read own" ON public.release_submission_tracks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.release_submissions rs
      JOIN public.artist_members am ON am.artist_id = rs.artist_id
      WHERE rs.id = submission_id AND am.user_id = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "release_submission_tracks: editor+ read all" ON public.release_submission_tracks;
CREATE POLICY "release_submission_tracks: editor+ read all" ON public.release_submission_tracks
  FOR SELECT USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "video_submissions: artist insert own" ON public.video_submissions;
CREATE POLICY "video_submissions: artist insert own" ON public.video_submissions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = video_submissions.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "video_submissions: artist read own" ON public.video_submissions;
CREATE POLICY "video_submissions: artist read own" ON public.video_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = video_submissions.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "video_submissions: editor+ read all" ON public.video_submissions;
CREATE POLICY "video_submissions: editor+ read all" ON public.video_submissions
  FOR SELECT USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "video_submissions: editor+ update" ON public.video_submissions;
CREATE POLICY "video_submissions: editor+ update" ON public.video_submissions
  FOR UPDATE USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "submission_form_schema: editor+ write" ON public.submission_form_schema;
CREATE POLICY "submission_form_schema: editor+ write" ON public.submission_form_schema
  FOR ALL USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "submission_release_type_rules: editor+ write" ON public.submission_release_type_rules;
CREATE POLICY "submission_release_type_rules: editor+ write" ON public.submission_release_type_rules
  FOR ALL USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "submission_form_drafts: member all own" ON public.submission_form_drafts;
CREATE POLICY "submission_form_drafts: member all own" ON public.submission_form_drafts
  FOR ALL
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = submission_form_drafts.artist_id AND am.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = submission_form_drafts.artist_id AND am.user_id = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "portal_faq_categories: editor+ write" ON public.portal_faq_categories;
CREATE POLICY "portal_faq_categories: editor+ write" ON public.portal_faq_categories
  FOR ALL USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "portal_faq_items: editor+ write" ON public.portal_faq_items;
CREATE POLICY "portal_faq_items: editor+ write" ON public.portal_faq_items
  FOR ALL USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "artist_invoices: artist read own" ON public.artist_invoices;
CREATE POLICY "artist_invoices: artist read own" ON public.artist_invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.artist_members
      WHERE artist_members.artist_id = artist_invoices.artist_id
        AND artist_members.user_id   = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "artist_invoices: artist write own" ON public.artist_invoices;
CREATE POLICY "artist_invoices: artist write own" ON public.artist_invoices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.artist_members
      WHERE artist_members.artist_id = artist_invoices.artist_id
        AND artist_members.user_id   = (SELECT auth.uid())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artist_members
      WHERE artist_members.artist_id = artist_invoices.artist_id
        AND artist_members.user_id   = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "artist_invoices: admin all" ON public.artist_invoices;
CREATE POLICY "artist_invoices: admin all" ON public.artist_invoices
  FOR ALL USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "artist_billing_profiles: artist read own" ON public.artist_billing_profiles;
CREATE POLICY "artist_billing_profiles: artist read own" ON public.artist_billing_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.artist_members
      WHERE artist_members.artist_id = artist_billing_profiles.artist_id
        AND artist_members.user_id   = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "artist_billing_profiles: artist write own" ON public.artist_billing_profiles;
CREATE POLICY "artist_billing_profiles: artist write own" ON public.artist_billing_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.artist_members
      WHERE artist_members.artist_id = artist_billing_profiles.artist_id
        AND artist_members.user_id   = (SELECT auth.uid())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artist_members
      WHERE artist_members.artist_id = artist_billing_profiles.artist_id
        AND artist_members.user_id   = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "artist_billing_profiles: admin all" ON public.artist_billing_profiles;
CREATE POLICY "artist_billing_profiles: admin all" ON public.artist_billing_profiles
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "artist_documents: artist read own" ON public.artist_documents;
CREATE POLICY "artist_documents: artist read own" ON public.artist_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.artist_members
      WHERE artist_members.artist_id = artist_documents.artist_id
        AND artist_members.user_id   = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "artist_documents: artist write own" ON public.artist_documents;
CREATE POLICY "artist_documents: artist write own" ON public.artist_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.artist_members
      WHERE artist_members.artist_id = artist_documents.artist_id
        AND artist_members.user_id   = (SELECT auth.uid())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artist_members
      WHERE artist_members.artist_id = artist_documents.artist_id
        AND artist_members.user_id   = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "artist_documents: admin all" ON public.artist_documents;
CREATE POLICY "artist_documents: admin all" ON public.artist_documents
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "portal_feedback: artist insert own" ON public.portal_feedback;
CREATE POLICY "portal_feedback: artist insert own" ON public.portal_feedback
  FOR INSERT WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = portal_feedback.artist_id
        AND am.user_id = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "portal_feedback: artist read own" ON public.portal_feedback;
CREATE POLICY "portal_feedback: artist read own" ON public.portal_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = portal_feedback.artist_id
        AND am.user_id = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "portal_feedback: editor+ read all" ON public.portal_feedback;
CREATE POLICY "portal_feedback: editor+ read all" ON public.portal_feedback
  FOR SELECT USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "portal_feedback: editor+ update" ON public.portal_feedback;
CREATE POLICY "portal_feedback: editor+ update" ON public.portal_feedback
  FOR UPDATE USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "user_roles: own read" ON public.user_roles;
CREATE POLICY "user_roles: own read" ON public.user_roles
  FOR SELECT USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "user_roles: admin all" ON public.user_roles;
CREATE POLICY "user_roles: admin all" ON public.user_roles
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "portal_msg_folders: artist own" ON public.portal_message_folders;
CREATE POLICY "portal_msg_folders: artist own" ON public.portal_message_folders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = portal_message_folders.artist_id AND am.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = portal_message_folders.artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "portal_msg_folders: admin all" ON public.portal_message_folders;
CREATE POLICY "portal_msg_folders: admin all" ON public.portal_message_folders
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "portal_messages: sender own" ON public.portal_messages;
CREATE POLICY "portal_messages: sender own" ON public.portal_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = from_artist_id AND am.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = from_artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "portal_messages: recipient read" ON public.portal_messages;
CREATE POLICY "portal_messages: recipient read" ON public.portal_messages
  FOR SELECT USING (
    to_artist_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM public.artist_members am WHERE am.artist_id = to_artist_id AND am.user_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "portal_messages: admin all" ON public.portal_messages;
CREATE POLICY "portal_messages: admin all" ON public.portal_messages
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "portal_attach: via message sender" ON public.portal_message_attachments;
CREATE POLICY "portal_attach: via message sender" ON public.portal_message_attachments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.portal_messages pm
      JOIN public.artist_members am ON am.artist_id = pm.from_artist_id
      WHERE pm.id = portal_message_attachments.message_id AND am.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portal_messages pm
      JOIN public.artist_members am ON am.artist_id = pm.from_artist_id
      WHERE pm.id = portal_message_attachments.message_id AND am.user_id = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "portal_attach: admin all" ON public.portal_message_attachments;
CREATE POLICY "portal_attach: admin all" ON public.portal_message_attachments
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "sos_rules_presets: admin all" ON public.sos_rules_presets;
CREATE POLICY "sos_rules_presets: admin all" ON public.sos_rules_presets
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "sos_accounting_workspaces: admin/editor all" ON public.sos_accounting_workspaces;
CREATE POLICY "sos_accounting_workspaces: admin/editor all" ON public.sos_accounting_workspaces
  FOR ALL USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "settlement_operations: admin all" ON public.settlement_operations;
CREATE POLICY "settlement_operations: admin all" ON public.settlement_operations
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "sepa_payment_orders: admin all" ON public.sepa_payment_orders;
CREATE POLICY "sepa_payment_orders: admin all" ON public.sepa_payment_orders
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "sos_period_summaries: admin all" ON public.sos_period_summaries;
CREATE POLICY "sos_period_summaries: admin all" ON public.sos_period_summaries
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "settlement_periods: admin all" ON public.settlement_periods;
CREATE POLICY "settlement_periods: admin all" ON public.settlement_periods
  FOR ALL USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "settlement_ledger: artist read own" ON public.artist_settlement_ledger;
CREATE POLICY "settlement_ledger: artist read own" ON public.artist_settlement_ledger
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.artist_members
      WHERE artist_members.artist_id = artist_settlement_ledger.artist_id
        AND artist_members.user_id   = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "settlement_ledger: admin all" ON public.artist_settlement_ledger;
CREATE POLICY "settlement_ledger: admin all" ON public.artist_settlement_ledger
  FOR ALL USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "carry_forwards: artist read own" ON public.period_carry_forwards;
CREATE POLICY "carry_forwards: artist read own" ON public.period_carry_forwards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.artist_members
      WHERE artist_members.artist_id = period_carry_forwards.artist_id
        AND artist_members.user_id   = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "carry_forwards: admin all" ON public.period_carry_forwards;
CREATE POLICY "carry_forwards: admin all" ON public.period_carry_forwards
  FOR ALL USING ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "financial_audit: admin read" ON public.financial_audit_events;
CREATE POLICY "financial_audit: admin read" ON public.financial_audit_events
  FOR SELECT USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "financial_audit: admin insert" ON public.financial_audit_events;
CREATE POLICY "financial_audit: admin insert" ON public.financial_audit_events
  FOR INSERT WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "promo_log: admin all" ON public.promo_log_entries;
CREATE POLICY "promo_log: admin all" ON public.promo_log_entries
  FOR ALL
  USING  ((SELECT public.get_my_role()) IN ('admin', 'editor'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "promo_log: artist read" ON public.promo_log_entries;
CREATE POLICY "promo_log: artist read" ON public.promo_log_entries
  FOR SELECT
  USING (
    artist_id IN (
      SELECT artist_id FROM public.artist_members WHERE user_id = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS "r2_storage_snapshots: staff read" ON public.r2_storage_snapshots;
CREATE POLICY "r2_storage_snapshots: staff read" ON public.r2_storage_snapshots
  FOR SELECT USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "r2_storage_snapshots: admin write" ON public.r2_storage_snapshots;
CREATE POLICY "r2_storage_snapshots: admin write" ON public.r2_storage_snapshots
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');
DROP POLICY IF EXISTS "r2_orphan_objects: staff read" ON public.r2_orphan_objects;
CREATE POLICY "r2_orphan_objects: staff read" ON public.r2_orphan_objects
  FOR SELECT USING ((SELECT public.get_my_role()) IN ('admin', 'editor'));
DROP POLICY IF EXISTS "r2_orphan_objects: admin write" ON public.r2_orphan_objects;
CREATE POLICY "r2_orphan_objects: admin write" ON public.r2_orphan_objects
  FOR ALL USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');

-- Fixed resolution for trigger-only functions (built-ins only).
ALTER FUNCTION public.reject_invoice_pdf_mutation() SET search_path = '';
ALTER FUNCTION public.set_api_credentials_updated_at() SET search_path = '';
ALTER FUNCTION public.set_site_settings_updated_at() SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = '';
DO $$ BEGIN
  IF to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
  END IF;
END; $$;
CREATE INDEX IF NOT EXISTS idx_artist_assets_artist_id_lookup ON public.artist_assets (artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_replies_message_id_lookup ON public.artist_replies (message_id);
CREATE INDEX IF NOT EXISTS idx_artist_replies_artist_id_lookup ON public.artist_replies (artist_id);
CREATE INDEX IF NOT EXISTS idx_artists_user_id_lookup ON public.artists (user_id);
CREATE INDEX IF NOT EXISTS idx_sales_statements_batch_id_lookup ON public.sales_statements (batch_id);
CREATE INDEX IF NOT EXISTS idx_sales_statements_settlement_period_id_lookup ON public.sales_statements (settlement_period_id);
CREATE INDEX IF NOT EXISTS idx_artist_invoices_settlement_period_id_lookup ON public.artist_invoices (settlement_period_id);
CREATE INDEX IF NOT EXISTS idx_sales_statement_line_items_release_id_lookup ON public.sales_statement_line_items (release_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_artist_id_lookup ON public.ai_usage_events (artist_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_conversation_id_lookup ON public.ai_usage_events (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_diagnostics_user_id_lookup ON public.ai_diagnostics (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_diagnostics_artist_id_lookup ON public.ai_diagnostics (artist_id);
CREATE INDEX IF NOT EXISTS idx_portal_messages_folder_id_lookup ON public.portal_messages (folder_id);
CREATE INDEX IF NOT EXISTS idx_portal_messages_sender_user_id_lookup ON public.portal_messages (sender_user_id);

DROP POLICY IF EXISTS "role_permissions: authenticated read" ON public.role_permissions;
CREATE POLICY "role_permissions: authenticated read" ON public.role_permissions
  FOR SELECT USING ((SELECT auth.role()) = 'authenticated');
DROP POLICY IF EXISTS "portal_feature_flags: authenticated read" ON public.portal_feature_flags;
CREATE POLICY "portal_feature_flags: authenticated read" ON public.portal_feature_flags
  FOR SELECT USING ((SELECT auth.role()) = 'authenticated');
COMMIT;
