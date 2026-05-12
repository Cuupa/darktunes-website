/**
 * src/lib/api/youtubeApi.ts
 *
 * Utility to fetch the latest videos from a YouTube channel via the
 * YouTube Data API v3.
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

interface YouTubeSearchResult {
  items: Array<{
    id: { videoId: string }
    snippet: {
      title: string
      publishedAt: string
      channelTitle: string
      thumbnails: {
        high?: { url: string }
        medium?: { url: string }
        default?: { url: string }
      }
    }
  }>
}

/**
 * Fetches the latest N videos from a YouTube channel using the Data API v3.
 *
 * @param channelId - The YouTube channel ID (e.g. "UCxxxxxxxx")
 * @param apiKey    - YouTube Data API v3 key
 * @param maxResults - Number of results to fetch (default 20, max 50)
 */
export async function fetchYouTubeChannelVideos(
  channelId: string,
  apiKey: string,
  maxResults = 20,
): Promise<YouTubeVideoItem[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('channelId', channelId)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('order', 'date')
  url.searchParams.set('type', 'video')
  url.searchParams.set('maxResults', String(Math.min(maxResults, 50)))

  const res = await fetch(url.toString())
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const errBody = await res.json() as { error?: { message?: string; status?: string } }
      if (errBody?.error?.message) detail = errBody.error.message
    } catch {
      // Ignore parse errors
    }
    if (res.status === 403) {
      throw new Error(`YouTube API quota exceeded or key invalid: ${detail}`)
    }
    if (res.status === 400) {
      throw new Error(`YouTube API bad request (check channel ID): ${detail}`)
    }
    throw new Error(`YouTube API error: ${detail}`)
  }

  const data: YouTubeSearchResult = await res.json() as YouTubeSearchResult

  return (data.items ?? []).map((item) => ({
    youtubeId: item.id.videoId,
    title: item.snippet.title,
    thumbnailUrl:
      item.snippet.thumbnails.high?.url ??
      item.snippet.thumbnails.medium?.url ??
      item.snippet.thumbnails.default?.url ??
      '',
    publishedAt: item.snippet.publishedAt,
    channelTitle: item.snippet.channelTitle,
  }))
}
