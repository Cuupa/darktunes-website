/**
 * src/lib/sync/syncYouTubeChannel.ts
 *
 * Shared YouTube channel sync. Used by both entry points so they cannot drift:
 *   - POST /api/sync-youtube      (pg_cron daily job)
 *   - POST /api/sync-api with apiSource=youtube (admin force sync)
 *
 * Fetches the newest channel videos, links them to visible artists by title,
 * upserts them (preserving admin-hidden rows) and writes one sync_logs row.
 * Throws YouTubeSyncError after logging so the caller can map it to a status.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { fetchYouTubeChannelVideos, isYouTubeShort } from '@/lib/api/youtubeApi'
import { createArtistMatcher, resolveVideoArtist } from '@/lib/api/videoAttribution'
import { recordSyncLog } from '@/lib/api/syncLogs'

export interface YouTubeChannelSyncResult {
  synced: number
  truncated: boolean
}

/**
 * Cap channel pages so a cron run does not burn the full YouTube quota / hit
 * Vercel maxDuration. Newest uploads first; older uploads are never reached.
 * Shared by both entry points so the caps cannot drift apart again.
 */
export const MAX_YOUTUBE_CHANNEL_VIDEOS = 500

export class YouTubeSyncError extends Error {
  constructor(
    message: string,
    public readonly kind: 'fetch' | 'db' = 'fetch',
  ) {
    super(message)
    this.name = 'YouTubeSyncError'
  }
}

export async function syncYouTubeChannel(
  db: SupabaseClient<Database>,
  opts: { apiKey: string; channelId: string; maxVideos: number },
): Promise<YouTubeChannelSyncResult> {
  let videos
  try {
    videos = await fetchYouTubeChannelVideos(opts.channelId, opts.apiKey, opts.maxVideos)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await recordSyncLog(db, {
      artist_id: null,
      status: 'error',
      message: msg,
      releases_synced: 0,
      errors: [msg],
      api_source: 'youtube',
      rate_limited: /quota|429|rate/i.test(msg),
    })
    throw new YouTubeSyncError(msg, 'fetch')
  }

  if (videos.length === 0) {
    await recordSyncLog(db, {
      artist_id: null,
      status: 'success',
      message: 'No videos returned from YouTube',
      releases_synced: 0,
      errors: [],
      api_source: 'youtube',
      rate_limited: false,
    })
    return { synced: 0, truncated: false }
  }

  // is_visible intentionally excluded on upsert so admin-hidden videos are not
  // re-shown on every sync; new videos default to TRUE via the column default.
  const { data: artists, error: artistsError } = await db
    .from('artists')
    .select('id, name')
    .eq('is_visible', true)

  if (artistsError) {
    const msg = `Artist lookup failed: ${artistsError.message}`
    await recordSyncLog(db, {
      artist_id: null,
      status: 'error',
      message: msg,
      releases_synced: 0,
      errors: [msg],
      api_source: 'youtube',
      rate_limited: false,
    })
    throw new YouTubeSyncError(msg, 'db')
  }

  const artistMatchers = (artists ?? [])
    .map(createArtistMatcher)
    .filter((m): m is NonNullable<typeof m> => Boolean(m))

  const rows = videos.map((v) => {
    const { artistId } = resolveVideoArtist(v.title, v.channelTitle, artistMatchers)
    return {
      artist_id: artistId,
      youtube_id: v.youtubeId,
      title: v.title,
      thumbnail_url: v.thumbnailUrl,
      published_at: v.publishedAt,
      is_short: isYouTubeShort(v.durationSeconds, v.title),
    }
  })

  const { error } = await db
    .from('videos')
    .upsert(rows, { onConflict: 'youtube_id', ignoreDuplicates: false })

  if (error) {
    const msg = `DB upsert failed: ${error.message}`
    await recordSyncLog(db, {
      artist_id: null,
      status: 'error',
      message: msg,
      releases_synced: 0,
      errors: [msg],
      api_source: 'youtube',
      rate_limited: false,
    })
    throw new YouTubeSyncError(msg, 'db')
  }

  const truncated = videos.length >= opts.maxVideos
  await recordSyncLog(db, {
    artist_id: null,
    status: truncated ? 'partial' : 'success',
    message: truncated ? `Synced newest ${opts.maxVideos} videos (channel cap).` : null,
    releases_synced: videos.length,
    errors: truncated ? [`Synced newest ${opts.maxVideos} videos (channel cap).`] : [],
    api_source: 'youtube',
    rate_limited: false,
  })

  return { synced: videos.length, truncated }
}
