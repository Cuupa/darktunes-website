import { describe, it, expect, vi } from 'vitest'
import {
  fetchYouTubeChannelVideos,
  fetchVideoDurations,
  parseIso8601Duration,
  isYouTubeShort,
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

function mockVideoListPage(items: Array<{ id: string; duration: string }>) {
  return {
    items: items.map(({ id, duration }) => ({
      id,
      contentDetails: { duration },
    })),
  }
}

// ---------------------------------------------------------------------------
// parseIso8601Duration
// ---------------------------------------------------------------------------

describe('parseIso8601Duration', () => {
  it('parses seconds only (PT45S)', () => {
    expect(parseIso8601Duration('PT45S')).toBe(45)
  })

  it('parses minutes and seconds (PT1M30S)', () => {
    expect(parseIso8601Duration('PT1M30S')).toBe(90)
  })

  it('parses hours, minutes and seconds (PT2H3M10S)', () => {
    expect(parseIso8601Duration('PT2H3M10S')).toBe(7390)
  })

  it('parses minutes only (PT3M)', () => {
    expect(parseIso8601Duration('PT3M')).toBe(180)
  })

  it('returns 0 for empty or invalid strings', () => {
    expect(parseIso8601Duration('')).toBe(0)
    expect(parseIso8601Duration('invalid')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// isYouTubeShort
// ---------------------------------------------------------------------------

describe('isYouTubeShort', () => {
  it('returns true for videos ≤ 180 s', () => {
    expect(isYouTubeShort(45, 'My Short')).toBe(true)
    expect(isYouTubeShort(180, 'My Short')).toBe(true)
  })

  it('returns false for videos > 180 s without #shorts tag', () => {
    expect(isYouTubeShort(181, 'Music Video')).toBe(false)
    expect(isYouTubeShort(600, 'Full Track')).toBe(false)
  })

  it('returns true when title contains #shorts regardless of duration', () => {
    expect(isYouTubeShort(300, 'Cool clip #shorts')).toBe(true)
    expect(isYouTubeShort(0, 'Teaser #Shorts')).toBe(true)
  })

  it('returns false when durationSeconds is 0 and no #shorts tag', () => {
    expect(isYouTubeShort(0, 'Unknown duration')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// fetchVideoDurations
// ---------------------------------------------------------------------------

describe('fetchVideoDurations', () => {
  it('returns a map of videoId → seconds from a single batch', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify(mockVideoListPage([
          { id: 'abc1', duration: 'PT45S' },
          { id: 'def2', duration: 'PT3M0S' },
        ])),
        { status: 200 },
      ),
    )

    const origFetch = globalThis.fetch
    globalThis.fetch = mockFetch as typeof fetch
    try {
      const result = await fetchVideoDurations(['abc1', 'def2'], 'api-key')
      expect(result.get('abc1')).toBe(45)
      expect(result.get('def2')).toBe(180)
      expect(mockFetch).toHaveBeenCalledOnce()
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('batches in groups of 50', async () => {
    const ids = Array.from({ length: 55 }, (_, i) => `id${i}`)
    const batch1 = ids.slice(0, 50).map((id) => ({ id, duration: 'PT30S' }))
    const batch2 = ids.slice(50).map((id) => ({ id, duration: 'PT30S' }))

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockVideoListPage(batch1)), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockVideoListPage(batch2)), { status: 200 }),
      )

    const origFetch = globalThis.fetch
    globalThis.fetch = mockFetch as typeof fetch
    try {
      const result = await fetchVideoDurations(ids, 'api-key')
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.size).toBe(55)
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('returns an empty map when ids is empty', async () => {
    const result = await fetchVideoDurations([], 'api-key')
    expect(result.size).toBe(0)
  })

  it('skips a batch silently on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response('', { status: 500 }),
    )

    const origFetch = globalThis.fetch
    globalThis.fetch = mockFetch as typeof fetch
    try {
      const result = await fetchVideoDurations(['abc1'], 'api-key')
      expect(result.size).toBe(0)
    } finally {
      globalThis.fetch = origFetch
    }
  })
})

// ---------------------------------------------------------------------------
// fetchYouTubeChannelVideos
// ---------------------------------------------------------------------------

describe('fetchYouTubeChannelVideos', () => {
  it('returns mapped video items with durationSeconds from a single page', async () => {
    const mockItems = [makeItem('abc1'), makeItem('def2')]
    const mockFetch = vi.fn()
      // playlist page
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockFetchPage(mockItems)), { status: 200 }),
      )
      // durations batch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(mockVideoListPage([
            { id: 'abc1', duration: 'PT45S' },
            { id: 'def2', duration: 'PT5M0S' },
          ])),
          { status: 200 },
        ),
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
        durationSeconds: 45,
      })
      expect(result[1].durationSeconds).toBe(300)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('paginates using nextPageToken to fill maxVideos', async () => {
    const page1Items = Array.from({ length: 3 }, (_, i) => makeItem(`vid${i}`))
    const page2Items = Array.from({ length: 2 }, (_, i) => makeItem(`vid${i + 3}`))
    const allIds = [...page1Items, ...page2Items].map((_, i) => ({ id: `vid${i}`, duration: 'PT30S' }))

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockFetchPage(page1Items, 'TOKEN')), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockFetchPage(page2Items)), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockVideoListPage(allIds)), { status: 200 }),
      )

    const origFetch = globalThis.fetch
    globalThis.fetch = mockFetch as typeof fetch
    try {
      const result = await fetchYouTubeChannelVideos(CHANNEL_ID, 'api-key-test', 5)
      expect(result).toHaveLength(5)
      expect(mockFetch).toHaveBeenCalledTimes(3)
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

  it('derives the uploads playlist ID by replacing UC with UULF', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockFetchPage([])), { status: 200 }),
      )

    const origFetch = globalThis.fetch
    globalThis.fetch = mockFetch as typeof fetch
    try {
      await fetchYouTubeChannelVideos('UCLFuCYsYBaq3j0gM4wWo82LkQ', 'key', 10)
      const calledUrl = new URL((mockFetch.mock.calls[0] as [string])[0])
      // UC + rest → UULF + rest (e.g. UCLF… → UULFLF…)
      expect(calledUrl.searchParams.get('playlistId')).toBe('UULFLFuCYsYBaq3j0gM4wWo82LkQ')
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
