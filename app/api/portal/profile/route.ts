/**
 * app/api/portal/profile/route.ts
 *
 * PUT /api/portal/profile — partial or full upsert of the artist's EPK profile
 * and shared artists-table fields.
 *
 * Security:
 *   - withPortalMembership (Bearer + artist_members)
 *   - Field allowlists only (no raw body passthrough)
 *   - portalMemberWrite canary (service-role default; optional user JWT)
 *
 * Partial payloads: omit keys that should not change. artist_id is required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { withErrorHandler, buildApiError } from '@/lib/errors'
import { getArtistProfileByArtistId, upsertArtistProfile } from '@/lib/api/artistProfiles'
import { syncPortalGalleryToPressKit } from '@/lib/api/portalGalleryPress'
import { portalMemberWrite, withPortalMembership } from '@/lib/portal/withPortalMembership'
import { z } from 'zod'
import { scryptSync, randomBytes } from 'crypto'
import type { Database } from '@/types/database'

type ArtistUpdate = Database['public']['Tables']['artists']['Update']
type ArtistEpkInsert = Database['public']['Tables']['artist_epks']['Insert']
type NullableUrl = string | null | undefined

/** Hash a plaintext password using scrypt. Returns `salt:hash` hex string. */
function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(plain, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

/**
 * Accept absolute URLs, empty/null, or legacy non-URL storage paths (relative
 * R2 keys, protocol-relative CDN paths). Strict `.url()` alone rejected real
 * roster data and blocked otherwise-valid profile saves with 400.
 */
const optionalMediaUrl = z.union([
  z.string().url(),
  z.literal(''),
  z.null(),
  z.string().max(2000),
]).optional()

const optionalLinkUrl = z.union([z.string().url(), z.literal(''), z.null()]).optional()

const profileBodySchema = z.object({
  artist_id: z.string().uuid(),
  // artists.bio can be long HTML from the label CMS; portal form only re-sends it.
  bio: z.string().max(50000).nullable().optional(),
  bio_short: z.string().max(6000).nullable().optional(),
  bio_medium: z.string().max(12000).nullable().optional(),
  bio_long: z.string().max(30000).nullable().optional(),
  image_url: optionalMediaUrl,
  genres: z.array(z.string()).optional(),
  // Social/streaming URLs — stored in the artists table (single source of truth).
  // Accepted here so the form submits a single payload; written to artists only.
  website_url: optionalLinkUrl,
  instagram_url: optionalLinkUrl,
  youtube_url: optionalLinkUrl,
  bandcamp_url: optionalLinkUrl,
  spotify_url: optionalLinkUrl,
  apple_music_url: optionalLinkUrl,
  tiktok_url: optionalLinkUrl,
  facebook_url: optionalLinkUrl,
  press_quote: z.string().max(1000).nullable().optional(),
  founding_year: z.number().int().min(1900).max(2100).nullable().optional(),
  hometown: z.string().max(200).nullable().optional(),
  booking_contact: z.string().max(500).nullable().optional(),
  press_contact: z.string().max(500).nullable().optional(),
  soundcloud_url: optionalLinkUrl,
  custom_links: z.array(
    z.object({
      label: z.string(),
      url: z.union([z.string().url(), z.literal(''), z.null()]),
    }),
  ).nullable().optional(),
  rider_stage_plot_url: optionalMediaUrl,
  rider_technical_url: optionalMediaUrl,
  rider_hospitality_url: optionalMediaUrl,
  // EPK customisation
  epk_theme: z.string().max(50).optional(),
  epk_layout: z.enum(['classic', 'magazine', 'minimal', 'full-bleed']).optional(),
  epk_orientation: z.enum(['portrait', 'landscape']).optional(),
  epk_bg_image_url: optionalMediaUrl,
  epk_bg_opacity: z.number().int().min(0).max(100).optional(),
  epk_sections_order: z.array(z.string()).optional(),
  epk_sections_hidden: z.array(z.string()).optional(),
  // EPK password protection — client sends plaintext; hashed before persist
  epk_password_raw: z.string().max(200).nullable().optional(),
  epk_password_sections: z.array(z.string()).optional(),
  // EPK gallery + custom theme
  epk_gallery_photos: z.array(z.union([z.string().url(), z.literal(''), z.null(), z.string().max(2000)])).optional(),
  epk_custom_theme_tokens: z.record(z.string(), z.string()).nullable().optional(),
})

const normalizeUrl = (v: NullableUrl): string | null => (v === '' ? null : v ?? null)

const ROUTE = 'PUT /api/portal/profile'

export const PUT = withErrorHandler(async (req: NextRequest) => {
  // 1. Validate body first (cheap) then membership
  const body: unknown = await req.json()
  const parsed = profileBodySchema.safeParse(body)
  if (!parsed.success) {
    console.error('[portal/profile] validation failed:', parsed.error.flatten())
    throw buildApiError('VALIDATION_ERROR', 400)
  }

  // 2. Auth + membership (pins artist; spoofed artist_id rejected)
  const ctx = await withPortalMembership(req, parsed.data.artist_id)
  const { artist, user, serviceDb } = ctx

  // 3. Split artists-table fields vs artist_epks fields
  const d = parsed.data
  const {
    website_url,
    instagram_url,
    youtube_url,
    bandcamp_url,
    spotify_url,
    apple_music_url,
    tiktok_url,
    facebook_url,
    soundcloud_url,
    image_url,
    rider_stage_plot_url,
    rider_technical_url,
    rider_hospitality_url,
    epk_bg_image_url,
    custom_links,
    epk_gallery_photos,
    bio,
    genres,
    founding_year,
    hometown,
    epk_password_raw,
    artist_id: _artistId,
    ...profileFields
  } = d

  let epkPasswordHash: string | null | undefined = undefined
  if (epk_password_raw !== undefined) {
    epkPasswordHash = epk_password_raw ? hashPassword(epk_password_raw) : null
  }

  const normalizedCustomLinks = custom_links == null
    ? custom_links
    : custom_links
      .map((link) => ({ ...link, url: normalizeUrl(link.url) }))
      .filter((link): link is { label: string; url: string } => link.url !== null)

  const normalizedGalleryPhotos = epk_gallery_photos
    ?.map((url) => normalizeUrl(url))
    .filter((url): url is string => url !== null)

  const profileData: ArtistEpkInsert = {
    ...profileFields,
    artist_id: artist.id,
    ...(rider_stage_plot_url !== undefined ? { rider_stage_plot_url: normalizeUrl(rider_stage_plot_url) } : {}),
    ...(rider_technical_url !== undefined ? { rider_technical_url: normalizeUrl(rider_technical_url) } : {}),
    ...(rider_hospitality_url !== undefined ? { rider_hospitality_url: normalizeUrl(rider_hospitality_url) } : {}),
    ...(epk_bg_image_url !== undefined ? { epk_bg_image_url: normalizeUrl(epk_bg_image_url) } : {}),
    ...(custom_links !== undefined ? { custom_links: normalizedCustomLinks } : {}),
    ...(epk_gallery_photos !== undefined ? { epk_gallery_photos: normalizedGalleryPhotos } : {}),
    ...(epkPasswordHash !== undefined ? { epk_password_hash: epkPasswordHash } : {}),
  }

  // Partial update: only touch artist_epks when EPK-side keys were sent
  const epkPatchKeys = Object.keys(profileData).filter((k) => k !== 'artist_id')
  const hasEpkPatch = epkPatchKeys.length > 0

  let profile = null
  if (hasEpkPatch) {
    try {
      const epkResult = await portalMemberWrite(
        ctx,
        { route: ROUTE, table: 'artist_epks', operation: 'upsert' },
        (db) => upsertArtistProfile(db, profileData),
      )
      profile = epkResult.value
    } catch (upsertErr) {
      console.error('[portal/profile] artist_epks upsert failed:', upsertErr)
      throw buildApiError('SERVER_ERROR', 500)
    }
  } else {
    // Hometown-only (etc.): return current EPK row without a no-op upsert
    profile = await getArtistProfileByArtistId(serviceDb, artist.id)
  }

  // Press-kit sync only when gallery was part of this request
  if (epk_gallery_photos !== undefined) {
    try {
      await syncPortalGalleryToPressKit(
        serviceDb,
        artist.id,
        normalizedGalleryPhotos ?? [],
        user.id,
      )
    } catch (syncErr) {
      console.error('[portal/profile] gallery press sync failed (profile saved):', syncErr)
    }
  }

  // 4. Shared artists fields — only keys present in the payload
  const artistUpdate: ArtistUpdate = {}
  if (bio !== undefined) artistUpdate.bio = bio ?? ''
  if (genres !== undefined) artistUpdate.genres = genres
  if (founding_year !== undefined) artistUpdate.founding_year = founding_year
  if (hometown !== undefined) artistUpdate.hometown = hometown
  if (website_url !== undefined) artistUpdate.website_url = normalizeUrl(website_url)
  if (instagram_url !== undefined) artistUpdate.instagram_url = normalizeUrl(instagram_url)
  if (youtube_url !== undefined) artistUpdate.youtube_url = normalizeUrl(youtube_url)
  if (bandcamp_url !== undefined) artistUpdate.bandcamp_url = normalizeUrl(bandcamp_url)
  if (spotify_url !== undefined) artistUpdate.spotify_url = normalizeUrl(spotify_url)
  if (apple_music_url !== undefined) artistUpdate.apple_music_url = normalizeUrl(apple_music_url)
  if (tiktok_url !== undefined) artistUpdate.tiktok_url = normalizeUrl(tiktok_url)
  if (facebook_url !== undefined) artistUpdate.facebook_url = normalizeUrl(facebook_url)
  if (soundcloud_url !== undefined) artistUpdate.soundcloud_url = normalizeUrl(soundcloud_url)
  if (image_url !== undefined) artistUpdate.image_url = normalizeUrl(image_url)

  const hasArtistPatch = Object.keys(artistUpdate).length > 0
  if (hasArtistPatch) {
    artistUpdate.updated_at = new Date().toISOString()
    try {
      await portalMemberWrite(
        ctx,
        { route: ROUTE, table: 'artists', operation: 'update' },
        async (db) => {
          const { error: artistUpdateError } = await db
            .from('artists')
            .update(artistUpdate)
            .eq('id', artist.id)
          if (artistUpdateError) throw new Error(artistUpdateError.message)
        },
      )
    } catch (artistErr) {
      console.error('[portal/profile] artists update failed:', artistErr)
      throw buildApiError('SERVER_ERROR', 500)
    }
  }

  if (artist.slug) {
    revalidatePath(`/artists/${artist.slug}`)
    revalidatePath(`/press/artists/${artist.slug}`)
  }
  revalidatePath('/artists')

  return NextResponse.json({ profile })
})
