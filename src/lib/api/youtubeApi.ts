/**
 * src/lib/api/youtubeApi.ts
 *
 * Utility to fetch videos from a YouTube channel via the YouTube Data API v3.
 *
 * Uses the channel's "uploads" playlist (playlistItems API) instead of the
 * search API because playlistItems supports cursor-based pagination via
 * nextPageToken / prevPageToken and is not subject to search quota limits.
 *
 * Requires youtube_api_key to be configured in Admin → API Keys.
 */

export interface YouTubeVideoItem {
  youtubeId: string
  title: string
  thumbnailUrl: string
  publishedAt: string
  channelTitle: string
  /** Video duration in seconds, populated via a separate videos.list call. */
  durationSeconds: number
}

interface PlaylistItemsPage {
  nextPageToken?: string
  items: Array<{
    snippet: {
      title: string
      publishedAt: string
      channelTitle: string
      resourceId: { videoId: string }
      thumbnails: {
        high?: { url: string }
        medium?: { url: string }
        default?: { url: string }
      }
    }
    contentDetails?: {
      videoId: string
      videoPublishedAt?: string
    }
  }>
}

/**
 * Derives the channel "uploads" playlist ID.
 * YouTube convention: replace the leading "UC" with "UU" (all uploads).
 * e.g. "UCLFuCYsYBaq3j0gM4wWo82LkQ" → "UULFuCYsYBaq3j0gM4wWo82LkQ"
 *
 * Other prefixes (not used here): UULF long-form only, UUSH Shorts, UULV live.
 * Shorts filtering is handled separately via duration / is_short, not playlist choice.
 */
function uploadsPlaylistId(channelId: string): string {
  if (channelId.startsWith('UC')) {
    return 'UU' + channelId.slice(2)
  }
  return channelId
}

async function fetchPage(
  playlistId: string,
  apiKey: string,
  maxResults: number,
  pageToken?: string,
): Promise<PlaylistItemsPage> {
  const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('playlistId', playlistId)
  url.searchParams.set('part', 'snippet,contentDetails')
  url.searchParams.set('maxResults', String(Math.min(maxResults, 50)))
  if (pageToken) url.searchParams.set('pageToken', pageToken)

  const res = await fetch(url.toString())
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const errBody = await res.json() as { error?: { message?: string } }
      if (errBody?.error?.message) detail = errBody.error.message
    } catch {
      // Ignore parse errors
    }
    if (res.status === 403) {
      throw new Error(`YouTube API quota exceeded or key invalid: ${detail}`)
    }
    if (res.status === 400) {
      throw new Error(`YouTube API bad request (check channel/playlist ID): ${detail}`)
    }
    throw new Error(`YouTube API error: ${detail}`)
  }

  return res.json() as Promise<PlaylistItemsPage>
}

interface VideoListPage {
  items: Array<{
    id: string
    contentDetails?: { duration?: string }
  }>
}

/**
 * Parses an ISO 8601 duration string (e.g. "PT1M30S", "PT45S", "PT2H3M10S")
 * and returns the total number of seconds.
 */
export function parseIso8601Duration(duration: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration)
  if (!match) return 0
  const hours = parseInt(match[1] ?? '0', 10)
  const minutes = parseInt(match[2] ?? '0', 10)
  const seconds = parseInt(match[3] ?? '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Fetches video durations for up to 50 IDs per batch via the YouTube Data API
 * `videos.list` endpoint (part=contentDetails). Returns a map of videoId → seconds.
 */
export async function fetchVideoDurations(
  ids: string[],
  apiKey: string,
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (ids.length === 0) return result

  // Batch in groups of 50 (YouTube API maximum)
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    const url = new URL('https://www.googleapis.com/youtube/v3/videos')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('id', batch.join(','))
    url.searchParams.set('part', 'contentDetails')

    const res = await fetch(url.toString())
    if (!res.ok) continue // skip batch on error; duration defaults to 0

    const page = await res.json() as VideoListPage
    for (const item of page.items ?? []) {
      const raw = item.contentDetails?.duration
      result.set(item.id, raw ? parseIso8601Duration(raw) : 0)
    }
  }

  return result
}

/**
 * Returns true when a video should be classified as a YouTube Short.
 *
 * Criteria (either is sufficient):
 * - Duration ≤ 180 s (YouTube extended Shorts to 3 min in Oct 2024)
 * - Title contains "#shorts" or "#Shorts" (creator-added tag)
 */
export function isYouTubeShort(durationSeconds: number, title: string): boolean {
  return (durationSeconds > 0 && durationSeconds <= 180) ||
    title.toLowerCase().includes('#shorts')
}

/**
 * Fetches up to `maxVideos` videos from a YouTube channel's uploads playlist,
 * paging through results using the nextPageToken cursor.
 *
 * @param channelId  - The YouTube channel ID (e.g. "UCxxxxxxxx")
 * @param apiKey     - YouTube Data API v3 key
 * @param maxVideos  - Maximum total number of videos to return (default 50)
 */
export async function fetchYouTubeChannelVideos(
  channelId: string,
  apiKey: string,
  maxVideos = 50,
): Promise<YouTubeVideoItem[]> {
  const playlistId = uploadsPlaylistId(channelId)
  const results: YouTubeVideoItem[] = []
  let pageToken: string | undefined

  while (results.length < maxVideos) {
    const remaining = maxVideos - results.length
    const page = await fetchPage(playlistId, apiKey, Math.min(remaining, 50), pageToken)

    for (const item of page.items ?? []) {
      const videoId =
        item.snippet.resourceId?.videoId ??
        item.contentDetails?.videoId
      if (!videoId) continue
      results.push({
        youtubeId: videoId,
        title: item.snippet.title,
        thumbnailUrl:
          item.snippet.thumbnails.high?.url ??
          item.snippet.thumbnails.medium?.url ??
          item.snippet.thumbnails.default?.url ??
          '',
        publishedAt:
          item.contentDetails?.videoPublishedAt ??
          item.snippet.publishedAt,
        channelTitle: item.snippet.channelTitle,
        durationSeconds: 0, // populated below via videos.list
      })
    }

    if (!page.nextPageToken || results.length >= maxVideos) break
    pageToken = page.nextPageToken
  }

  // Enrich with durations from the videos.list API (one batch call per 50 IDs)
  if (results.length > 0) {
    const ids = results.map((v) => v.youtubeId)
    const durationsMap = await fetchVideoDurations(ids, apiKey)
    for (const video of results) {
      video.durationSeconds = durationsMap.get(video.youtubeId) ?? 0
    }
  }

  return results
}
