import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getStreamingStatsByArtistId, getAggregatedStreamsByPlatform } from './streamingStats'

type DbClient = SupabaseClient<Database>
type StreamingStatRow = Database['public']['Tables']['streaming_stats']['Row']

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeMockDb(data: unknown = null, error: unknown = null): DbClient {
  return { from: vi.fn().mockReturnValue(makeBuilder(data, error)) } as unknown as DbClient
}

const mockRows: StreamingStatRow[] = [
  {
    id: 'stat-1',
    artist_id: 'artist-uuid',
    platform: 'spotify',
    period: '2024-01',
    streams: 12500,
    created_at: '2024-02-01T00:00:00Z',
  },
  {
    id: 'stat-2',
    artist_id: 'artist-uuid',
    platform: 'apple_music',
    period: '2024-01',
    streams: 4300,
    created_at: '2024-02-01T00:00:00Z',
  },
  {
    id: 'stat-3',
    artist_id: 'artist-uuid',
    platform: 'spotify',
    period: '2024-02',
    streams: 15200,
    created_at: '2024-03-01T00:00:00Z',
  },
]

describe('getStreamingStatsByArtistId', () => {
  it('returns an empty array when there are no stats', async () => {
    const db = makeMockDb([])
    const result = await getStreamingStatsByArtistId(db, 'artist-uuid')
    expect(result).toEqual([])
  })

  it('maps rows to StreamingStat domain objects', async () => {
    const db = makeMockDb(mockRows)
    const result = await getStreamingStatsByArtistId(db, 'artist-uuid')
    expect(result).toHaveLength(3)
    expect(result[0].platform).toBe('spotify')
    expect(result[0].period).toBe('2024-01')
    expect(result[0].streams).toBe(12500)
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'Access denied', code: 'PGRST301' })
    await expect(getStreamingStatsByArtistId(db, 'artist-uuid')).rejects.toThrow('Access denied')
  })
})

describe('getAggregatedStreamsByPlatform', () => {
  it('aggregates streams grouped by platform from stat rows', () => {
    const stats = mockRows.map((r) => ({
      id: r.id,
      artistId: r.artist_id,
      platform: r.platform,
      period: r.period,
      streams: r.streams,
      createdAt: r.created_at,
    }))
    const result = getAggregatedStreamsByPlatform(stats)
    expect(result).toHaveLength(2) // spotify + apple_music
    const spotify = result.find((r) => r.platform === 'spotify')
    expect(spotify?.totalStreams).toBe(12500 + 15200)
    const apple = result.find((r) => r.platform === 'apple_music')
    expect(apple?.totalStreams).toBe(4300)
  })

  it('returns empty array for empty input', () => {
    expect(getAggregatedStreamsByPlatform([])).toEqual([])
  })
})
