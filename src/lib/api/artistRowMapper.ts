/**
 * src/lib/api/artistRowMapper.ts
 *
 * Shared mapper: converts a raw `artists` DB row to the Artist domain type.
 * Extracted into its own module so both `artists.ts` and `artistProfiles.ts`
 * can share it without circular imports.
 */

import type { Database } from '@/types/database'
import type { Artist } from '@/types'

type ArtistRow = Database['public']['Tables']['artists']['Row']

export function rowToArtist(row: ArtistRow): Artist {
  const fallbackSlug = row.name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return {
    id: row.id,
    name: row.name,
    slug: (row.slug ?? '').trim() || fallbackSlug,
    bio: row.bio ?? '',
    genres: row.genres,
    imageUrl: row.image_url ?? '',
    spotifyUrl: row.spotify_url ?? undefined,
    appleMusicUrl: row.apple_music_url ?? undefined,
    instagramUrl: row.instagram_url ?? undefined,
    youtubeUrl: row.youtube_url ?? undefined,
    websiteUrl: row.website_url ?? undefined,
    facebookUrl: row.facebook_url ?? undefined,
    twitterUrl: row.twitter_url ?? undefined,
    tiktokUrl: row.tiktok_url ?? undefined,
    bandcampUrl: row.bandcamp_url ?? undefined,
    shopUrl: row.shop_url ?? undefined,
    featured: row.featured,
    country: row.country ?? undefined,
    email: row.email ?? undefined,
    vatNumber: row.vat_number ?? undefined,
    isEuNonGerman: row.is_eu_non_german,
    notes: row.notes ?? undefined,
    spotifyId: row.spotify_id ?? undefined,
    discogsId: row.discogs_id ?? undefined,
    songkickId: row.songkick_id ?? undefined,
    bandsintownId: row.bandsintown_id ?? undefined,
    lastSyncedAt: row.last_synced_at ?? undefined,
    foundedYear: row.founded_year ?? undefined,
    isVisible: row.is_visible,
    logoUrl: row.logo_url ?? undefined,
  }
}
