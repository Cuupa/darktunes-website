/**
 * src/lib/api/youtubeApi.ts
 *
 * Utility to fetch videos from a YouTube channel via the YouTube Data API v3.
 *
 * Uses the channel's "uploads" playlist (playlistItems API) instead of the
 * search API because playlistItems supports cursor-based pagination via
 * nextPageToken / prevPageToken and is not subject to search quota limits.
 *
 * Requires YOUTUBE_API_KEY to be set as a server-side environment variable.
 */

export interface YouTubeVideoItem {
  youtubeId: string
  title: string
  thumbnailUrl: string
  publishedAt: string
  channelTitle: string
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
 * Derives the uploads-playlist ID for a channel.
 * YouTube's convention: replace the leading "UC" with "UU".
 * e.g. "UCLFuCYsYBaq3j0gM4wWo82LkQ" → "UULFuCYsYBaq3j0gM4wWo82LkQ"
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
      })
    }

    if (!page.nextPageToken || results.length >= maxVideos) break
    pageToken = page.nextPageToken
  }

  return results
}
