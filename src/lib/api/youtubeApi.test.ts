import { describe, it, expect, vi } from 'vitest'
import {
  fetchYouTubeChannelVideos,
  type YouTubeVideoItem,
} from './youtubeApi'

const CHANNEL_ID = 'UCLFuCYsYBaq3j0gM4wWo82LkQ'

function makeItem(id: string, title = 'Test Video') {
  return {
    snippet: {
      title,
      publishedAt: '2024-01-01T00:00:00Z',
      channelTitle: 'Test Channel',
      resourceId: { videoId: id },
      thumbnails: {
        high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
      },
    },
    contentDetails: {
      videoId: id,
      videoPublishedAt: '2024-01-01T00:00:00Z',
    },
  }
}

function mockFetchPage(items: ReturnType<typeof makeItem>[], nextPageToken?: string) {
  return {
    nextPageToken,
    items,
  }
}

describe('fetchYouTubeChannelVideos', () => {
  it('returns mapped video items from a single page', async () => {
    const mockItems = [makeItem('abc1'), makeItem('def2')]
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockFetchPage(mockItems)), { status: 200 }),
    )

    const origFetch = globalThis.fetch
    globalThis.fetch = mockFetch as typeof fetch
    try {
      const result = await fetchYouTubeChannelVideos(CHANNEL_ID, 'api-key-test', 50)

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject<Partial<YouTubeVideoItem>>({
        youtubeId: 'abc1',
        title: 'Test Video',
        channelTitle: 'Test Channel',
        publishedAt: '2024-01-01T00:00:00Z',
      })
      expect(mockFetch).toHaveBeenCalledOnce()
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('paginates using nextPageToken to fill maxVideos', async () => {
    const page1Items = Array.from({ length: 3 }, (_, i) => makeItem(`vid${i}`))
    const page2Items = Array.from({ length: 2 }, (_, i) => makeItem(`vid${i + 3}`))

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockFetchPage(page1Items, 'TOKEN')), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockFetchPage(page2Items)), { status: 200 }),
      )

    const origFetch = globalThis.fetch
    globalThis.fetch = mockFetch as typeof fetch
    try {
      const result = await fetchYouTubeChannelVideos(CHANNEL_ID, 'api-key-test', 5)
      expect(result).toHaveLength(5)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('throws on 403 YouTube API response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'quotaExceeded' } }), { status: 403 }),
    )

    const origFetch = globalThis.fetch
    globalThis.fetch = mockFetch as typeof fetch
    try {
      await expect(
        fetchYouTubeChannelVideos(CHANNEL_ID, 'bad-key', 10),
      ).rejects.toThrow('YouTube API quota exceeded or key invalid')
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('throws on 400 YouTube API response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'invalidChannelId' } }), { status: 400 }),
    )

    const origFetch = globalThis.fetch
    globalThis.fetch = mockFetch as typeof fetch
    try {
      await expect(
        fetchYouTubeChannelVideos('invalid-id', 'key', 10),
      ).rejects.toThrow('YouTube API bad request')
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('derives the uploads playlist ID by replacing UC with UU', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockFetchPage([])), { status: 200 }),
    )

    const origFetch = globalThis.fetch
    globalThis.fetch = mockFetch as typeof fetch
    try {
      await fetchYouTubeChannelVideos('UCLFuCYsYBaq3j0gM4wWo82LkQ', 'key', 10)
      const calledUrl = new URL((mockFetch.mock.calls[0] as [string])[0])
      expect(calledUrl.searchParams.get('playlistId')).toBe('UULFuCYsYBaq3j0gM4wWo82LkQ')
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('skips items with no videoId', async () => {
    const itemWithNoId = {
      snippet: {
        title: 'No ID',
        publishedAt: '2024-01-01T00:00:00Z',
        channelTitle: 'Test',
        resourceId: { videoId: '' },
        thumbnails: {
          high: { url: '' },
        },
      },
      contentDetails: { videoId: '', videoPublishedAt: '2024-01-01T00:00:00Z' },
    }

    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockFetchPage([itemWithNoId])), { status: 200 }),
    )

    const origFetch = globalThis.fetch
    globalThis.fetch = mockFetch as typeof fetch
    try {
      const result = await fetchYouTubeChannelVideos(CHANNEL_ID, 'key', 10)
      expect(result).toHaveLength(0)
    } finally {
      globalThis.fetch = origFetch
    }
  })
})
