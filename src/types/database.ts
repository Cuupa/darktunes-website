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
          role: 'admin' | 'editor' | 'user'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'admin' | 'editor' | 'user'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'editor' | 'user'
          created_at?: string
          updated_at?: string
        }
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
          instagram_url: string | null
          youtube_url: string | null
          website_url: string | null
          featured: boolean
          country: string | null
          email: string | null
          vat_number: string | null
          is_eu_non_german: boolean
          notes: string | null
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
          instagram_url?: string | null
          youtube_url?: string | null
          website_url?: string | null
          featured?: boolean
          country?: string | null
          email?: string | null
          vat_number?: string | null
          is_eu_non_german?: boolean
          notes?: string | null
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
          instagram_url?: string | null
          youtube_url?: string | null
          website_url?: string | null
          featured?: boolean
          country?: string | null
          email?: string | null
          vat_number?: string | null
          is_eu_non_german?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
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
          created_at?: string
          updated_at?: string
        }
      }
      news_posts: {
        Row: {
          id: string
          title: string
          slug: string
          excerpt: string | null
          content: string
          image_url: string | null
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
          published_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      videos: {
        Row: {
          id: string
          title: string
          artist_name: string
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
          youtube_id?: string
          thumbnail_url?: string | null
          published_at?: string
          created_at?: string
          updated_at?: string
        }
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
      }
    }
  }
}
