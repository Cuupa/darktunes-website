/**
 * app/api/sync-api/route.ts — Per-API force sync
 *
 * POST /api/sync-api
 * Body: { apiSource: string }
 * Auth: ******
 *
 * Runs a targeted sync for a single API source (itunes, spotify, discogs,
 * songkick, bandsintown, odesli, or youtube).
 *
 * For youtube, this delegates to the same logic as /api/sync-youtube.
 * For all other sources, it calls syncAll with the onlyApi filter.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import type { Database } from '@/types/database'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { syncAll } from '@/lib/sync/syncAll'
import { createR2Client, uploadUrlToR2 } from '@/lib/r2Utils'
import { fetchYouTubeChannelVideos } from '@/lib/api/youtubeApi'

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
  const authHeader = request.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid Authorization header')
  }
  await verifyToken(authHeader.slice(7))

  // 2. Parse body
  const body = (await request.json()) as { apiSource?: string }
  const { apiSource } = body
  if (!apiSource) {
    throw new ApiError(400, 'Missing required field: apiSource')
  }

  // 3. Validate Supabase config
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new ApiError(500, 'Supabase is not configured', 'MISSING_SUPABASE_CONFIG')
  }

  // 4. YouTube — handled separately (no R2 needed)
  if (apiSource === 'youtube') {
    const youtubeApiKey = process.env.YOUTUBE_API_KEY
    const youtubeChannelId = process.env.YOUTUBE_CHANNEL_ID
    if (!youtubeApiKey)
      throw new ApiError(500, 'YOUTUBE_API_KEY is not configured', 'MISSING_CONFIG')
    if (!youtubeChannelId)
      throw new ApiError(500, 'YOUTUBE_CHANNEL_ID is not configured', 'MISSING_CONFIG')

    const db = createClient<Database>(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    let videos
    try {
      videos = await fetchYouTubeChannelVideos(youtubeChannelId, youtubeApiKey, 20)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new ApiError(502, `YouTube API error: ${msg}`, 'YOUTUBE_FETCH_ERROR')
    }

    if (videos.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No videos returned from YouTube' })
    }

    const { data: artists } = await db
      .from('artists')
      .select('id, name')
      .eq('is_visible', true)

    const artistMatchers = (artists ?? [])
      .map((a) => ({
        id: a.id,
        pattern: a.name.trim()
          ? new RegExp(
              `(^|\\W)${a.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`,
              'i',
            )
          : null,
      }))
      .filter((a): a is { id: string; pattern: RegExp } => Boolean(a.pattern))

    const rows = videos.map((v) => ({
      artist_id: artistMatchers.find((a) => a.pattern.test(v.title))?.id ?? null,
      youtube_id: v.youtubeId,
      title: v.title,
      artist_name: v.channelTitle,
      thumbnail_url: v.thumbnailUrl,
      published_at: v.publishedAt,
      is_visible: true,
    }))

    const { error } = await db
      .from('videos')
      .upsert(rows, { onConflict: 'youtube_id', ignoreDuplicates: false })
    if (error) throw new ApiError(500, `DB upsert failed: ${error.message}`)

    // Write a sync_log entry so the health dashboard reflects the last YouTube sync time
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
  }

  // APIs that do not require R2 (no image uploads): odesli, songkick, bandsintown
  const NO_R2_APIS = new Set(['odesli', 'songkick', 'bandsintown'])

  // 5. APIs that need R2 — enforce R2 config, or skip for no-upload APIs
  const {
    CLOUDFLARE_R2_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    CLOUDFLARE_R2_BUCKET_NAME,
    CLOUDFLARE_R2_PUBLIC_URL,
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    DISCOGS_TOKEN,
    SONGKICK_API_KEY,
    BANDSINTOWN_API_KEY,
  } = process.env

  if (
    !CLOUDFLARE_R2_ACCOUNT_ID ||
    !CLOUDFLARE_R2_ACCESS_KEY_ID ||
    !CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
    !CLOUDFLARE_R2_BUCKET_NAME ||
    !CLOUDFLARE_R2_PUBLIC_URL
  ) {
    if (!NO_R2_APIS.has(apiSource ?? '')) {
      throw new ApiError(500, 'R2 storage is not configured', 'MISSING_R2_CONFIG')
    }
  }

  const db = createClient<Database>(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const uploadFn: (imageUrl: string, keyPrefix: string) => Promise<string> =
    CLOUDFLARE_R2_ACCOUNT_ID &&
    CLOUDFLARE_R2_ACCESS_KEY_ID &&
    CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    CLOUDFLARE_R2_BUCKET_NAME &&
    CLOUDFLARE_R2_PUBLIC_URL
      ? (imageUrl, keyPrefix) =>
          uploadUrlToR2(
            imageUrl,
            createR2Client(
              CLOUDFLARE_R2_ACCOUNT_ID,
              CLOUDFLARE_R2_ACCESS_KEY_ID,
              CLOUDFLARE_R2_SECRET_ACCESS_KEY,
            ),
            CLOUDFLARE_R2_BUCKET_NAME,
            CLOUDFLARE_R2_PUBLIC_URL,
            keyPrefix,
          )
      : // No R2 configured — only safe for APIs that never upload images
        async (_imageUrl: string) => _imageUrl

  const result = await syncAll({
    db,
    fetch: globalThis.fetch,
    uploadToR2: uploadFn,
    spotify:
      SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET
        ? { clientId: SPOTIFY_CLIENT_ID, clientSecret: SPOTIFY_CLIENT_SECRET }
        : undefined,
    discogsToken: DISCOGS_TOKEN,
    songkickApiKey: SONGKICK_API_KEY,
    bandsintownApiKey: BANDSINTOWN_API_KEY,
    onlyApi: apiSource,
  })

  revalidateTag('releases')
  revalidateTag('artists')
  revalidateTag('concerts')
  return NextResponse.json(result)
})
