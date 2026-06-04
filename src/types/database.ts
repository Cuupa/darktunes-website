export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      app_logs: {
        Row: {
          id: string
          source: string
          level: 'error' | 'warn' | 'info'
          message: string
          details: Record<string, unknown>
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          source: string
          level?: 'error' | 'warn' | 'info'
          message: string
          details?: Record<string, unknown>
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          source?: string
          level?: 'error' | 'warn' | 'info'
          message?: string
          details?: Record<string, unknown>
          user_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'editor' | 'journalist' | 'user' | 'artist'
          avatar_url: string | null
          provider: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          email: string
          role?: 'admin' | 'editor' | 'journalist' | 'user' | 'artist'
          avatar_url?: string | null
          provider?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'editor' | 'journalist' | 'user' | 'artist'
          avatar_url?: string | null
          provider?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          role: 'admin' | 'editor' | 'journalist' | 'user' | 'artist'
          can_publish_news: boolean
          can_edit_news: boolean
          can_manage_artists: boolean
          can_manage_releases: boolean
          can_manage_videos: boolean
          can_view_admin_panel: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          role: 'admin' | 'editor' | 'journalist' | 'user' | 'artist'
          can_publish_news?: boolean
          can_edit_news?: boolean
          can_manage_artists?: boolean
          can_manage_releases?: boolean
          can_manage_videos?: boolean
          can_view_admin_panel?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          role?: 'admin' | 'editor' | 'journalist' | 'user' | 'artist'
          can_publish_news?: boolean
          can_edit_news?: boolean
          can_manage_artists?: boolean
          can_manage_releases?: boolean
          can_manage_videos?: boolean
          can_view_admin_panel?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      artists: {
        Row: {
          id: string
          name: string
          slug: string
          bio: string | null
          genres: string[]
          image_url: string | null
          spotify_url: string | null
          apple_music_url: string | null
          instagram_url: string | null
          youtube_url: string | null
          website_url: string | null
          featured: boolean
          country: string | null
          email: string | null
          vat_number: string | null
          is_eu_non_german: boolean
          notes: string | null
          spotify_id: string | null
          discogs_id: string | null
          songkick_id: string | null
          bandsintown_id: string | null
          last_synced_at: string | null
          user_id: string | null
          facebook_url: string | null
          twitter_url: string | null
          tiktok_url: string | null
          bandcamp_url: string | null
          shop_url: string | null
          founded_year: number | null
          is_visible: boolean
          logo_url: string | null
          platform_links: Record<string, string> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          bio?: string | null
          genres?: string[]
          image_url?: string | null
          spotify_url?: string | null
          apple_music_url?: string | null
          instagram_url?: string | null
          youtube_url?: string | null
          website_url?: string | null
          featured?: boolean
          country?: string | null
          email?: string | null
          vat_number?: string | null
          is_eu_non_german?: boolean
          notes?: string | null
          spotify_id?: string | null
          discogs_id?: string | null
          songkick_id?: string | null
          bandsintown_id?: string | null
          last_synced_at?: string | null
          user_id?: string | null
          facebook_url?: string | null
          twitter_url?: string | null
          tiktok_url?: string | null
          bandcamp_url?: string | null
          shop_url?: string | null
          founded_year?: number | null
          is_visible?: boolean
          logo_url?: string | null
          platform_links?: Record<string, string> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          bio?: string | null
          genres?: string[]
          image_url?: string | null
          spotify_url?: string | null
          apple_music_url?: string | null
          instagram_url?: string | null
          youtube_url?: string | null
          website_url?: string | null
          featured?: boolean
          country?: string | null
          email?: string | null
          vat_number?: string | null
          is_eu_non_german?: boolean
          notes?: string | null
          spotify_id?: string | null
          discogs_id?: string | null
          songkick_id?: string | null
          bandsintown_id?: string | null
          last_synced_at?: string | null
          user_id?: string | null
          facebook_url?: string | null
          twitter_url?: string | null
          tiktok_url?: string | null
          bandcamp_url?: string | null
          shop_url?: string | null
          founded_year?: number | null
          is_visible?: boolean
          logo_url?: string | null
          platform_links?: Record<string, string> | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      artist_profiles: {
        Row: {
          id: string
          artist_id: string
          bio: string | null
          bio_short: string | null
          bio_medium: string | null
          bio_long: string | null
          photo_url: string | null
          genres: string[]
          website_url: string | null
          instagram_url: string | null
          youtube_url: string | null
          bandcamp_url: string | null
          press_quote: string | null
          founding_year: number | null
          hometown: string | null
          booking_contact: string | null
          press_contact: string | null
          spotify_url: string | null
          apple_music_url: string | null
          tiktok_url: string | null
          facebook_url: string | null
          soundcloud_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          artist_id: string
          bio?: string | null
          bio_short?: string | null
          bio_medium?: string | null
          bio_long?: string | null
          photo_url?: string | null
          genres?: string[]
          website_url?: string | null
          instagram_url?: string | null
          youtube_url?: string | null
          bandcamp_url?: string | null
          press_quote?: string | null
          founding_year?: number | null
          hometown?: string | null
          booking_contact?: string | null
          press_contact?: string | null
          spotify_url?: string | null
          apple_music_url?: string | null
          tiktok_url?: string | null
          facebook_url?: string | null
          soundcloud_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          artist_id?: string
          bio?: string | null
          bio_short?: string | null
          bio_medium?: string | null
          bio_long?: string | null
          photo_url?: string | null
          genres?: string[]
          website_url?: string | null
          instagram_url?: string | null
          youtube_url?: string | null
          bandcamp_url?: string | null
          press_quote?: string | null
          founding_year?: number | null
          hometown?: string | null
          booking_contact?: string | null
          press_contact?: string | null
          spotify_url?: string | null
          apple_music_url?: string | null
          tiktok_url?: string | null
          facebook_url?: string | null
          soundcloud_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      streaming_stats: {
        Row: {
          id: string
          artist_id: string
          platform: string
          period: string
          streams: number
          created_at: string
        }
        Insert: {
          id?: string
          artist_id: string
          platform: string
          period: string
          streams?: number
          created_at?: string
        }
        Update: {
          id?: string
          artist_id?: string
          platform?: string
          period?: string
          streams?: number
          created_at?: string
        }
        Relationships: []
      }
      sales_statements: {
        Row: {
          id: string
          artist_id: string
          filename: string
          r2_key: string
          period: string
          amount_eur: number | null
          created_at: string
        }
        Insert: {
          id?: string
          artist_id: string
          filename: string
          r2_key: string
          period: string
          amount_eur?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          artist_id?: string
          filename?: string
          r2_key?: string
          period?: string
          amount_eur?: number | null
          created_at?: string
        }
        Relationships: []
      }
      releases: {
        Row: {
          id: string
          title: string
          artist_id: string | null
          artist_name: string
          release_date: string
          cover_art: string | null
          type: 'album' | 'ep' | 'single'
          spotify_url: string | null
          apple_music_url: string | null
          youtube_url: string | null
          featured: boolean
          itunes_id: string | null
          spotify_id: string | null
          discogs_id: string | null
          isrc: string | null
          barcode: string | null
          catalog_number: string | null
          preview_url: string | null
          smart_url: string | null
          platform_links: Record<string, string> | null
          popularity: number | null
          is_visible: boolean
          is_promo: boolean
          promo_text: string | null
          hero_bg_url: string | null
          hero_primary_btn_label: string | null
          hero_primary_btn_action: string | null
          hero_primary_btn_href: string | null
          hero_secondary_btn_label: string | null
          hero_secondary_btn_action: string | null
          hero_secondary_btn_href: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          artist_id?: string | null
          artist_name: string
          release_date: string
          cover_art?: string | null
          type: 'album' | 'ep' | 'single'
          spotify_url?: string | null
          apple_music_url?: string | null
          youtube_url?: string | null
          featured?: boolean
          itunes_id?: string | null
          spotify_id?: string | null
          discogs_id?: string | null
          isrc?: string | null
          barcode?: string | null
          catalog_number?: string | null
          preview_url?: string | null
          smart_url?: string | null
          platform_links?: Record<string, string> | null
          popularity?: number | null
          is_visible?: boolean
          is_promo?: boolean
          promo_text?: string | null
          hero_bg_url?: string | null
          hero_primary_btn_label?: string | null
          hero_primary_btn_action?: string | null
          hero_primary_btn_href?: string | null
          hero_secondary_btn_label?: string | null
          hero_secondary_btn_action?: string | null
          hero_secondary_btn_href?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          artist_id?: string | null
          artist_name?: string
          release_date?: string
          cover_art?: string | null
          type?: 'album' | 'ep' | 'single'
          spotify_url?: string | null
          apple_music_url?: string | null
          youtube_url?: string | null
          featured?: boolean
          itunes_id?: string | null
          spotify_id?: string | null
          discogs_id?: string | null
          isrc?: string | null
          barcode?: string | null
          catalog_number?: string | null
          preview_url?: string | null
          smart_url?: string | null
          platform_links?: Record<string, string> | null
          popularity?: number | null
          is_visible?: boolean
          is_promo?: boolean
          promo_text?: string | null
          hero_bg_url?: string | null
          hero_primary_btn_label?: string | null
          hero_primary_btn_action?: string | null
          hero_primary_btn_href?: string | null
          hero_secondary_btn_label?: string | null
          hero_secondary_btn_action?: string | null
          hero_secondary_btn_href?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      concerts: {
        Row: {
          id: string
          artist_id: string | null
          artist_name: string
          event_name: string
          venue_name: string | null
          venue_city: string | null
          venue_country: string | null
          concert_date: string
          ticket_url: string | null
          songkick_id: string | null
          bandsintown_id: string | null
          status: string
          created_by: string | null
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          artist_id?: string | null
          artist_name: string
          event_name: string
          venue_name?: string | null
          venue_city?: string | null
          venue_country?: string | null
          concert_date: string
          ticket_url?: string | null
          songkick_id?: string | null
          bandsintown_id?: string | null
          status?: string
          created_by?: string | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          artist_id?: string | null
          artist_name?: string
          event_name?: string
          venue_name?: string | null
          venue_city?: string | null
          venue_country?: string | null
          concert_date?: string
          ticket_url?: string | null
          songkick_id?: string | null
          bandsintown_id?: string | null
          status?: string
          created_by?: string | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      news_posts: {
        Row: {
          id: string
          title: string
          slug: string
          excerpt: string | null
          content: string
          image_url: string | null
         featured: boolean
         is_press_only: boolean
          status: string
          published_at: string
          created_at: string
          updated_at: string
          artist_id: string | null
          reviewed_by: string | null
          embargo_until: string | null
          media_contact: string | null
          release_category: string | null
          hero_bg_url: string | null
          hero_primary_btn_label: string | null
          hero_primary_btn_action: string | null
          hero_primary_btn_href: string | null
          hero_secondary_btn_label: string | null
          hero_secondary_btn_action: string | null
          hero_secondary_btn_href: string | null
        }
        Insert: {
          id?: string
          title: string
          slug: string
          excerpt?: string | null
          content: string
          image_url?: string | null
          featured?: boolean
          is_press_only?: boolean
          status?: string
          published_at?: string
          created_at?: string
          updated_at?: string
          artist_id?: string | null
          reviewed_by?: string | null
          embargo_until?: string | null
          media_contact?: string | null
          release_category?: string | null
          hero_bg_url?: string | null
          hero_primary_btn_label?: string | null
          hero_primary_btn_action?: string | null
          hero_primary_btn_href?: string | null
          hero_secondary_btn_label?: string | null
          hero_secondary_btn_action?: string | null
          hero_secondary_btn_href?: string | null
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          excerpt?: string | null
          content?: string
          image_url?: string | null
          featured?: boolean
          is_press_only?: boolean
          status?: string
          published_at?: string
          created_at?: string
          updated_at?: string
          artist_id?: string | null
          reviewed_by?: string | null
          embargo_until?: string | null
          media_contact?: string | null
          release_category?: string | null
          hero_bg_url?: string | null
          hero_primary_btn_label?: string | null
          hero_primary_btn_action?: string | null
          hero_primary_btn_href?: string | null
          hero_secondary_btn_label?: string | null
          hero_secondary_btn_action?: string | null
          hero_secondary_btn_href?: string | null
        }
        Relationships: []
      }
      videos: {
        Row: {
          id: string
          title: string
          artist_name: string
          artist_id: string | null
          youtube_id: string
          thumbnail_url: string | null
          is_visible: boolean
          is_short: boolean
          published_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          artist_name: string
          artist_id?: string | null
          youtube_id: string
          thumbnail_url?: string | null
          is_visible?: boolean
          is_short?: boolean
          published_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          artist_name?: string
          artist_id?: string | null
          youtube_id?: string
          thumbnail_url?: string | null
          is_visible?: boolean
          is_short?: boolean
          published_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          id: string
          filename: string
          original_filename: string
          mime_type: string
          size_bytes: number
          r2_key: string
          public_url: string
          uploaded_by: string | null
          created_at: string
          folder_id: string | null
          artist_id: string | null
          tags: string[]
          sha256_hash: string | null
          release_id: string | null
        }
        Insert: {
          id?: string
          filename: string
          original_filename: string
          mime_type: string
          size_bytes: number
          r2_key: string
          public_url: string
          uploaded_by?: string | null
          created_at?: string
          folder_id?: string | null
          artist_id?: string | null
          tags?: string[]
          sha256_hash?: string | null
          release_id?: string | null
        }
        Update: {
          id?: string
          filename?: string
          original_filename?: string
          mime_type?: string
          size_bytes?: number
          r2_key?: string
          public_url?: string
          uploaded_by?: string | null
          created_at?: string
          folder_id?: string | null
          artist_id?: string | null
          tags?: string[]
          sha256_hash?: string | null
          release_id?: string | null
        }
        Relationships: []
      }
      asset_artists: {
        Row: {
          asset_id: string
          artist_id: string
        }
        Insert: {
          asset_id: string
          artist_id: string
        }
        Update: {
          asset_id?: string
          artist_id?: string
        }
        Relationships: []
      }
      asset_folders: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          artist_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
          artist_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          artist_id?: string | null
          created_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      media_folders: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          created_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      media_files: {
        Row: {
          id: string
          filename: string
          original_filename: string
          mime_type: string
          size_bytes: number
          r2_key: string
          public_url: string
          uploaded_by: string | null
          created_at: string
          folder_id: string | null
          artist_id: string | null
          tags: string[]
          sha256_hash: string | null
        }
        Insert: {
          id?: string
          filename: string
          original_filename: string
          mime_type: string
          size_bytes: number
          r2_key: string
          public_url: string
          uploaded_by?: string | null
          created_at?: string
          folder_id?: string | null
          artist_id?: string | null
          tags?: string[]
          sha256_hash?: string | null
        }
        Update: {
          id?: string
          filename?: string
          original_filename?: string
          mime_type?: string
          size_bytes?: number
          r2_key?: string
          public_url?: string
          uploaded_by?: string | null
          created_at?: string
          folder_id?: string | null
          artist_id?: string | null
          tags?: string[]
          sha256_hash?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          value: string
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          id: string
          artist_id: string | null
          status: 'success' | 'partial' | 'error'
          message: string | null
          releases_synced: number
          errors: string[]
          api_source: string
          rate_limited: boolean
          created_at: string
        }
        Insert: {
          id?: string
          artist_id?: string | null
          status: 'success' | 'partial' | 'error'
          message?: string | null
          releases_synced?: number
          errors?: string[]
          api_source?: string
          rate_limited?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          artist_id?: string | null
          status?: 'success' | 'partial' | 'error'
          message?: string | null
          releases_synced?: number
          errors?: string[]
          api_source?: string
          rate_limited?: boolean
          created_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          id: string
          email: string
          name: string | null
          source: string
          status: 'pending' | 'subscribed' | 'unsubscribed'
          verification_token: string | null
          unsubscribe_token: string | null
          subscribed_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          source?: string
          status?: 'pending' | 'subscribed' | 'unsubscribed'
          verification_token?: string | null
          unsubscribe_token?: string | null
          subscribed_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          source?: string
          status?: 'pending' | 'subscribed' | 'unsubscribed'
          verification_token?: string | null
          unsubscribe_token?: string | null
          subscribed_at?: string
        }
        Relationships: []
      }
      release_checklists: {
        Row: {
          id: string
          artist_id: string
          release_id: string
          task: string
          is_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          artist_id: string
          release_id: string
          task: string
          is_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          artist_id?: string
          release_id?: string
          task?: string
          is_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      press_photos: {
        Row: {
          id: string
          title: string
          alt_text: string | null
          r2_key: string
          public_url: string
          display_order: number
          category: string
          artist_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          alt_text?: string | null
          r2_key: string
          public_url: string
          display_order?: number
          category?: string
          artist_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          alt_text?: string | null
          r2_key?: string
          public_url?: string
          display_order?: number
          category?: string
          artist_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      promo_tracks: {
        Row: {
          id: string
          title: string
          artist_name: string
          r2_key: string
          file_size_bytes: number | null
          duration_seconds: number | null
          display_order: number
          genre: string | null
          bpm: number | null
          key: string | null
          release_date: string | null
          nda_required: boolean
          embargo_until: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          artist_name: string
          r2_key: string
          file_size_bytes?: number | null
          duration_seconds?: number | null
          display_order?: number
          genre?: string | null
          bpm?: number | null
          key?: string | null
          release_date?: string | null
          nda_required?: boolean
          embargo_until?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          artist_name?: string
          r2_key?: string
          file_size_bytes?: number | null
          duration_seconds?: number | null
          display_order?: number
          genre?: string | null
          bpm?: number | null
          key?: string | null
          release_date?: string | null
          nda_required?: boolean
          embargo_until?: string | null
          created_at?: string
        }
        Relationships: []
      }
      journalist_applications: {
        Row: {
          id: string
          user_id: string | null
          email: string
          name: string
          outlet: string
          message: string | null
          status: 'pending' | 'approved' | 'rejected'
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          email: string
          name: string
          outlet: string
          message?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          email?: string
          name?: string
          outlet?: string
          message?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      portal_feature_flags: {
        Row: {
          id: string
          label: string
          enabled: boolean
          target_role: string
          updated_at: string
        }
        Insert: {
          id: string
          label: string
          enabled?: boolean
          target_role: string
          updated_at?: string
        }
        Update: {
          id?: string
          label?: string
          enabled?: boolean
          target_role?: string
          updated_at?: string
        }
        Relationships: []
      }
      label_messages: {
        Row: {
          id: string
          artist_id: string
          subject: string
          body: string
          body_html: string | null
          read: boolean
          read_at: string | null
          starred: boolean
          deleted_at: string | null
          sent_at: string
        }
        Insert: {
          id?: string
          artist_id: string
          subject: string
          body: string
          body_html?: string | null
          read?: boolean
          read_at?: string | null
          starred?: boolean
          deleted_at?: string | null
          sent_at?: string
        }
        Update: {
          id?: string
          artist_id?: string
          subject?: string
          body?: string
          body_html?: string | null
          read?: boolean
          read_at?: string | null
          starred?: boolean
          deleted_at?: string | null
          sent_at?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          id: string
          name: string
          subject: string
          body_html: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          subject?: string
          body_html?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          subject?: string
          body_html?: string
          created_at?: string
        }
        Relationships: []
      }
      artist_replies: {
        Row: {
          id: string
          message_id: string
          artist_id: string
          body: string
          body_html: string | null
          deleted_at: string | null
          sent_at: string
        }
        Insert: {
          id?: string
          message_id: string
          artist_id: string
          body: string
          body_html?: string | null
          deleted_at?: string | null
          sent_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          artist_id?: string
          body?: string
          body_html?: string | null
          deleted_at?: string | null
          sent_at?: string
        }
        Relationships: []
      }
      artist_assets: {
        Row: {
          id: string
          artist_id: string
          filename: string
          original_filename: string
          mime_type: string
          size_bytes: number
          r2_key: string
          public_url: string
          label: string | null
          created_at: string
        }
        Insert: {
          id?: string
          artist_id: string
          filename: string
          original_filename: string
          mime_type: string
          size_bytes: number
          r2_key: string
          public_url: string
          label?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          artist_id?: string
          filename?: string
          original_filename?: string
          mime_type?: string
          size_bytes?: number
          r2_key?: string
          public_url?: string
          label?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_assets_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          }
        ]
      }
      journalist_downloads: {
        Row: {
          id: string
          journalist_id: string
          release_id: string | null
          asset_key: string
          downloaded_at: string
        }
        Insert: {
          id?: string
          journalist_id: string
          release_id?: string | null
          asset_key: string
          downloaded_at?: string
        }
        Update: {
          id?: string
          journalist_id?: string
          release_id?: string | null
          asset_key?: string
          downloaded_at?: string
        }
        Relationships: []
      }
      accreditation_requests: {
        Row: {
          id: string
          journalist_id: string
          event_name: string
          event_date: string
          publication: string
          reason: string
          status: 'pending' | 'approved' | 'rejected'
          admin_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          journalist_id: string
          event_name: string
          event_date: string
          publication: string
          reason: string
          status?: 'pending' | 'approved' | 'rejected'
          admin_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          journalist_id?: string
          event_name?: string
          event_date?: string
          publication?: string
          reason?: string
          status?: 'pending' | 'approved' | 'rejected'
          admin_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      editor_activity_log: {
        Row: {
          id: string
          editor_id: string
          action: string
          entity_type: string
          entity_id: string
          entity_name: string | null
          changes: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          editor_id: string
          action: string
          entity_type: string
          entity_id: string
          entity_name?: string | null
          changes?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          editor_id?: string
          action?: string
          entity_type?: string
          entity_id?: string
          entity_name?: string | null
          changes?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      editor_notifications: {
        Row: {
          id: string
          recipient_id: string
          type: string
          entity_type: string
          entity_id: string
          entity_name: string | null
          sender_id: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          recipient_id: string
          type: string
          entity_type: string
          entity_id: string
          entity_name?: string | null
          sender_id?: string | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          recipient_id?: string
          type?: string
          entity_type?: string
          entity_id?: string
          entity_name?: string | null
          sender_id?: string | null
          read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      interview_requests: {
        Row: {
          id: string
          journalist_id: string
          artist_id: string
          subject: string
          message: string
          preferred_date: string | null
          status: string
          artist_reply: string | null
          created_at: string
        }
        Insert: {
          id?: string
          journalist_id: string
          artist_id: string
          subject: string
          message: string
          preferred_date?: string | null
          status?: string
          artist_reply?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          journalist_id?: string
          artist_id?: string
          subject?: string
          message?: string
          preferred_date?: string | null
          status?: string
          artist_reply?: string | null
          created_at?: string
        }
        Relationships: []
      }
      role_changes: {
        Row: {
          id: string
          user_id: string
          old_role: string
          new_role: string
          changed_by: string
          changed_at: string
          reason: string | null
          ip_address: string | null
        }
        Insert: {
          id?: string
          user_id: string
          old_role: string
          new_role: string
          changed_by: string
          changed_at?: string
          reason?: string | null
          ip_address?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          old_role?: string
          new_role?: string
          changed_by?: string
          changed_at?: string
          reason?: string | null
          ip_address?: string | null
        }
        Relationships: []
      }
      ban_history: {
        Row: {
          id: string
          user_id: string
          banned: boolean
          banned_until: string | null
          changed_by: string
          changed_at: string
          reason: string | null
        }
        Insert: {
          id?: string
          user_id: string
          banned: boolean
          banned_until?: string | null
          changed_by: string
          changed_at?: string
          reason?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          banned?: boolean
          banned_until?: string | null
          changed_by?: string
          changed_at?: string
          reason?: string | null
        }
        Relationships: []
      }
      custom_permission_definitions: {
        Row: {
          id: string
          name: string
          label: string
          description: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          label: string
          description?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          label?: string
          description?: string | null
          created_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      custom_roles: {
        Row: {
          id: string
          name: string
          label: string
          description: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          label: string
          description?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          label?: string
          description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      custom_role_permissions: {
        Row: {
          role_id: string
          permission_name: string
        }
        Insert: {
          role_id: string
          permission_name: string
        }
        Update: {
          role_id?: string
          permission_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          }
        ]
      }
      user_custom_roles: {
        Row: {
          user_id: string
          role_id: string
          assigned_by: string | null
          assigned_at: string
        }
        Insert: {
          user_id: string
          role_id: string
          assigned_by?: string | null
          assigned_at?: string
        }
        Update: {
          user_id?: string
          role_id?: string
          assigned_by?: string | null
          assigned_at?: string
        }
        Relationships: []
      }
      rbac_audit_log: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          target_type: string
          target_id: string | null
          old_value: Record<string, unknown> | null
          new_value: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          target_type: string
          target_id?: string | null
          old_value?: Record<string, unknown> | null
          new_value?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          action?: string
          target_type?: string
          target_id?: string | null
          old_value?: Record<string, unknown> | null
          new_value?: Record<string, unknown> | null
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          resource: string
          resource_id: string | null
          details: Record<string, unknown> | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          resource: string
          resource_id?: string | null
          details?: Record<string, unknown> | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          action?: string
          resource?: string
          resource_id?: string | null
          details?: Record<string, unknown> | null
          ip_address?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      sync_status: 'success' | 'partial' | 'error'
      sync_api_source: 'itunes' | 'spotify' | 'discogs' | 'songkick' | 'odesli' | 'all'
    }
  }
}
