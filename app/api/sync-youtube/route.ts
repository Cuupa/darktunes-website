/**
 * app/api/sync-youtube/route.ts — YouTube video sync
 *
 * POST /api/sync-youtube
 * Auth:
 *   - Bearer <supabase-access-token>
 *   - OR Vercel cron request (x-vercel-cron: 1) — CRON_SECRET required
 *   - OR CRON_SECRET Bearer (pg_cron `sync-youtube-daily` job)
 *
 * Fetches the latest videos from the configured YouTube channel and upserts
 * them into the `videos` table. Delegates the actual work to
 * `syncYouTubeChannel` (shared with the apiSource=youtube branch of
 * /api/sync-api so both paths never drift).
 *
 * Not part of the artist sync_queue — needs its own Supabase pg_cron job
 * (`sync-youtube-daily` in the Supabase dashboard).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifySyncTrigger } from '@/lib/adminAuth'
import { isValidCronSecret } from '@/lib/cronAuth'
import { recordHealthHeartbeat } from '@/lib/health/heartbeats'
import { getYouTubeCredentials } from '@/lib/secrets/getExternalCredentials'
import { revalidatePublicContent, VIDEO_SYNC_TAGS } from '@/lib/sync/revalidatePublicContent'
import { recordSyncLog } from '@/lib/api/syncLogs'
import { syncYouTubeChannel, YouTubeSyncError, MAX_YOUTUBE_CHANNEL_VIDEOS } from '@/lib/sync/syncYouTubeChannel'

// Route-segment config: allow up to 300 seconds on Vercel Pro (default is 10 s on Hobby).
// Fetching all videos from a large channel can take longer than the default timeout.
export const maxDuration = 300

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  // 1. Authenticate — accept Vercel cron, CRON_SECRET Bearer, or user session
  const isCron = request.headers.get('x-vercel-cron') === '1'
  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (isCron) {
    if (!cronSecret || !isValidCronSecret(authHeader, cronSecret)) {
      throw new ApiError(401, 'Unauthorized')
    }
  } else if (cronSecret && isValidCronSecret(authHeader, cronSecret)) {
    // CRON_SECRET Bearer allowed for Supabase Edge Functions and external schedulers
  } else {
    const token = extractBearerToken(authHeader)
    await verifySyncTrigger(token)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new ApiError(500, 'Supabase is not configured', 'MISSING_SUPABASE_CONFIG')
  }

  const db = createClient<Database>(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Heartbeat first so cron health shows "ran" even when credentials/API fail later.
  await recordHealthHeartbeat(db, 'youtube')

  const { apiKey: youtubeApiKey, channelId: youtubeChannelId } = await getYouTubeCredentials(db)

  if (!youtubeApiKey) {
    await recordSyncLog(db, {
      artist_id: null,
      status: 'error',
      message: 'YouTube API key is not configured in Admin → API Keys',
      releases_synced: 0,
      errors: ['YouTube API key is not configured in Admin → API Keys'],
      api_source: 'youtube',
      rate_limited: false,
    })
    throw new ApiError(500, 'YouTube API key is not configured in Admin → API Keys', 'MISSING_CONFIG')
  }
  if (!youtubeChannelId) {
    await recordSyncLog(db, {
      artist_id: null,
      status: 'error',
      message: 'YouTube channel ID is not configured in Admin → API Keys',
      releases_synced: 0,
      errors: ['YouTube channel ID is not configured in Admin → API Keys'],
      api_source: 'youtube',
      rate_limited: false,
    })
    throw new ApiError(
      500,
      'YouTube channel ID is not configured in Admin → API Keys',
      'MISSING_CONFIG',
    )
  }

  let result
  try {
    result = await syncYouTubeChannel(db, {
      apiKey: youtubeApiKey,
      channelId: youtubeChannelId,
      maxVideos: MAX_YOUTUBE_CHANNEL_VIDEOS,
    })
  } catch (err) {
    if (err instanceof YouTubeSyncError) {
      if (err.kind === 'db') throw new ApiError(500, err.message)
      // Surface quota / key issues as 502 with a helpful message
      if (err.message.includes('quota') || err.message.includes('403')) {
        throw new ApiError(502, `YouTube API error: ${err.message}`, 'YOUTUBE_QUOTA_OR_KEY')
      }
      throw new ApiError(502, `YouTube API error: ${err.message}`, 'YOUTUBE_FETCH_ERROR')
    }
    throw err
  }

  if (result.synced === 0) {
    return NextResponse.json({ synced: 0, message: 'No videos returned from YouTube' })
  }

  revalidatePublicContent(VIDEO_SYNC_TAGS)

  return NextResponse.json({
    synced: result.synced,
    truncated: result.truncated,
    ...(result.truncated
      ? { message: `Synced newest ${MAX_YOUTUBE_CHANNEL_VIDEOS} videos (channel cap).` }
      : {}),
  })
})

export const GET = POST
