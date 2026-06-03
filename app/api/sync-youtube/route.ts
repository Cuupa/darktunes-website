/**
 * app/api/sync-youtube/route.ts — YouTube video sync
 *
 * POST /api/sync-youtube
 * Auth:
 *   - Bearer <supabase-access-token>
 *   - OR Vercel cron request (x-vercel-cron: 1), optionally guarded by CRON_SECRET
 *
 * Fetches the latest videos from the configured YouTube channel and upserts
 * them into the `videos` table.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import { timingSafeEqual } from 'node:crypto'
import type { Database } from '@/types/database'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { fetchYouTubeChannelVideos } from '@/lib/api/youtubeApi'
import { createArtistMatcher, resolveVideoArtist } from '@/lib/api/videoAttribution'

function isValidCronSecret(authHeader: string, cronSecret: string): boolean {
  const expected = `Bearer ${cronSecret}`
  const authBuffer = Buffer.from(authHeader, 'utf-8')
  const expectedBuffer = Buffer.from(expected, 'utf-8')
  if (authBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(authBuffer, expectedBuffer)
}

async function verifyToken(token: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new ApiError(500, 'Supabase service key not configured')

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new ApiError(401, 'Unauthorized')
}

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  // 1. Authenticate
  const isCron = request.headers.get('x-vercel-cron') === '1'
  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (isCron) {
    if (cronSecret && !isValidCronSecret(authHeader, cronSecret)) {
      throw new ApiError(401, 'Invalid cron secret')
    }
  } else {
    if (!authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Missing or invalid Authorization header')
    }
    await verifyToken(authHeader.slice(7))
  }

  // 2. Read required config
  const youtubeApiKey = process.env.YOUTUBE_API_KEY
  const youtubeChannelId = process.env.YOUTUBE_CHANNEL_ID

  if (!youtubeApiKey) throw new ApiError(500, 'YOUTUBE_API_KEY is not configured', 'MISSING_CONFIG')
  if (!youtubeChannelId)
    throw new ApiError(500, 'YOUTUBE_CHANNEL_ID is not configured', 'MISSING_CONFIG')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new ApiError(500, 'Supabase is not configured', 'MISSING_SUPABASE_CONFIG')
  }

  // 3. Fetch from YouTube
  let videos
  try {
    videos = await fetchYouTubeChannelVideos(youtubeChannelId, youtubeApiKey, 200)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Surface quota / key issues as 502 with a helpful message
    if (msg.includes('quota') || msg.includes('403')) {
      throw new ApiError(502, `YouTube API error: ${msg}`, 'YOUTUBE_QUOTA_OR_KEY')
    }
    throw new ApiError(502, `YouTube API error: ${msg}`, 'YOUTUBE_FETCH_ERROR')
  }

  if (videos.length === 0) {
    return NextResponse.json({ synced: 0, message: 'No videos returned from YouTube' })
  }

  // 4. Upsert into Supabase
  const db = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const { data: artists, error: artistsError } = await db
    .from('artists')
    .select('id, name')
    .eq('is_visible', true)
  if (artistsError) throw new ApiError(500, `Artist lookup failed: ${artistsError.message}`)

  const artistMatchers = (artists ?? [])
    .map(createArtistMatcher)
    .filter((m): m is NonNullable<typeof m> => Boolean(m))

  const rows = videos.map((v) => {
    const { artistId, artistName } = resolveVideoArtist(v.title, v.channelTitle, artistMatchers)
    return {
      // artist_id and artist_name: resolved from title match; fall back to channel title
      artist_id: artistId,
      youtube_id: v.youtubeId,
      title: v.title,
      artist_name: artistName,
      thumbnail_url: v.thumbnailUrl,
      published_at: v.publishedAt,
      // is_visible intentionally excluded so that admin-hidden videos are not
      // re-shown on every sync; new videos default to TRUE via the DB column default.
    }
  })

  const { error } = await db
    .from('videos')
    .upsert(rows, { onConflict: 'youtube_id', ignoreDuplicates: false })

  if (error) throw new ApiError(500, `DB upsert failed: ${error.message}`)

  // Write a sync_log entry so the health dashboard shows the last YouTube sync time
  await db.from('sync_logs').insert({
    artist_id: null,
    status: 'success',
    message: null,
    releases_synced: videos.length,
    errors: [],
    api_source: 'youtube',
    rate_limited: false,
  })

  revalidateTag('videos')

  return NextResponse.json({ synced: videos.length })
})
