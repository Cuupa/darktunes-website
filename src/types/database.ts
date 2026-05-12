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
      profiles: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'editor' | 'journalist' | 'user' | 'artist'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'admin' | 'editor' | 'journalist' | 'user' | 'artist'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'editor' | 'journalist' | 'user' | 'artist'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
          popularity: number | null
          is_visible: boolean
          is_promo: boolean
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
          popularity?: number | null
          is_visible?: boolean
          is_promo?: boolean
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
          popularity?: number | null
          is_visible?: boolean
          is_promo?: boolean
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
          is_press_only: boolean
          published_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          excerpt?: string | null
          content: string
          image_url?: string | null
          is_press_only?: boolean
          published_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          excerpt?: string | null
          content?: string
          image_url?: string | null
          is_press_only?: boolean
          published_at?: string
          created_at?: string
          updated_at?: string
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
          status: 'pending' | 'subscribed'
          verification_token: string | null
          subscribed_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          source?: string
          status?: 'pending' | 'subscribed'
          verification_token?: string | null
          subscribed_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          source?: string
          status?: 'pending' | 'subscribed'
          verification_token?: string | null
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
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          alt_text?: string | null
          r2_key: string
          public_url: string
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          alt_text?: string | null
          r2_key?: string
          public_url?: string
          display_order?: number
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
          read: boolean
          sent_at: string
        }
        Insert: {
          id?: string
          artist_id: string
          subject: string
          body: string
          read?: boolean
          sent_at?: string
        }
        Update: {
          id?: string
          artist_id?: string
          subject?: string
          body?: string
          read?: boolean
          sent_at?: string
        }
        Relationships: []
      }
      artist_replies: {
        Row: {
          id: string
          message_id: string
          artist_id: string
          body: string
          sent_at: string
        }
        Insert: {
          id?: string
          message_id: string
          artist_id: string
          body: string
          sent_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          artist_id?: string
          body?: string
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
        Relationships: []
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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      sync_status: 'success' | 'partial' | 'error'
      sync_api_source: 'itunes' | 'spotify' | 'discogs' | 'songkick' | 'odesli' | 'all'
    }
  }
}
