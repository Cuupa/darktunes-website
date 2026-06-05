/**
 * app/api/portal/profile/route.ts
 *
 * PUT /api/portal/profile — upsert the artist's EPK profile.
 *
 * Security:
 *   - Bearer token verified via Supabase Auth
 *   - artist_id in body validated against the authenticated user's linked artist
 *   - Supabase RLS provides a second layer of enforcement at the DB level
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId, upsertArtistProfile } from '@/lib/api/artistProfiles'
import { z } from 'zod'
import type { Database } from '@/types/database'

type ArtistUpdate = Database['public']['Tables']['artists']['Update']

const profileBodySchema = z.object({
  artist_id: z.string().uuid(),
  bio: z.string().max(2000).nullable().optional(),
  bio_short: z.string().max(6000).nullable().optional(),
  bio_medium: z.string().max(12000).nullable().optional(),
  bio_long: z.string().max(30000).nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  genres: z.array(z.string()).optional(),
  website_url: z.string().url().nullable().optional(),
  instagram_url: z.string().url().nullable().optional(),
  youtube_url: z.string().url().nullable().optional(),
  bandcamp_url: z.string().url().nullable().optional(),
  press_quote: z.string().max(1000).nullable().optional(),
  founding_year: z.number().int().min(1900).max(2100).nullable().optional(),
  hometown: z.string().max(200).nullable().optional(),
  booking_contact: z.string().max(500).nullable().optional(),
  press_contact: z.string().max(500).nullable().optional(),
  spotify_url: z.string().url().nullable().optional(),
  apple_music_url: z.string().url().nullable().optional(),
  tiktok_url: z.string().url().nullable().optional(),
  facebook_url: z.string().url().nullable().optional(),
  soundcloud_url: z.string().url().nullable().optional(),
  rider_stage_plot_url: z.string().url().nullable().optional(),
  rider_technical_url: z.string().url().nullable().optional(),
  rider_hospitality_url: z.string().url().nullable().optional(),
})

export const PUT = withErrorHandler(async (req: NextRequest) => {
  // 1. Authenticate
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ApiError(401, 'Missing authorization token')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) throw new ApiError(401, 'Invalid or expired token')

  // 2. Validate body
  const body: unknown = await req.json()
  const parsed = profileBodySchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((e) => e.message).join('; '))
  }

  // 3. Confirm the artist_id in the body belongs to the authenticated user
  const artist = await getArtistByUserId(supabase, user.id)
  if (!artist || artist.id !== parsed.data.artist_id) {
    throw new ApiError(403, 'You do not have permission to update this profile')
  }

  // 4. Upsert profile
  const profile = await upsertArtistProfile(supabase, parsed.data)

  // 5. Sync shared fields back to the artists table so both tables stay in sync
  const d = parsed.data
  const artistUpdate: ArtistUpdate = { updated_at: new Date().toISOString() }
  if (d.bio !== undefined) artistUpdate.bio = d.bio ?? ''
  if (d.genres !== undefined) artistUpdate.genres = d.genres
  if (d.website_url !== undefined) artistUpdate.website_url = d.website_url
  if (d.instagram_url !== undefined) artistUpdate.instagram_url = d.instagram_url
  if (d.youtube_url !== undefined) artistUpdate.youtube_url = d.youtube_url
  if (d.bandcamp_url !== undefined) artistUpdate.bandcamp_url = d.bandcamp_url
  if (d.spotify_url !== undefined) artistUpdate.spotify_url = d.spotify_url
  if (d.apple_music_url !== undefined) artistUpdate.apple_music_url = d.apple_music_url
  if (d.tiktok_url !== undefined) artistUpdate.tiktok_url = d.tiktok_url
  if (d.facebook_url !== undefined) artistUpdate.facebook_url = d.facebook_url
  if (d.founding_year !== undefined) artistUpdate.founded_year = d.founding_year

  await supabase.from('artists').update(artistUpdate).eq('id', artist.id)

  return NextResponse.json({ profile })
})
