import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getConcerts } from './concerts'

type DbClient = SupabaseClient<Database>
type ConcertRow = Database['public']['Tables']['concerts']['Row']

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeMockDb(data: unknown = null, error: unknown = null): DbClient {
  return { from: vi.fn().mockReturnValue(makeBuilder(data, error)) } as unknown as DbClient
}

const mockConcerts: ConcertRow[] = [
  {
    id: 'concert-cancelled',
    artist_id: 'artist-1',
    artist_name: 'Artist A',
    event_name: 'Cancelled Show',
    venue_name: 'Venue A',
    venue_city: 'Berlin',
    venue_country: 'Germany',
    concert_date: '2026-08-10T19:00:00Z',
    ticket_url: null,
    songkick_id: 'sk-1',
    status: 'cancelled',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'concert-ok',
    artist_id: 'artist-2',
    artist_name: 'Artist B',
    event_name: 'Upcoming Show',
    venue_name: 'Venue B',
    venue_city: 'Hamburg',
    venue_country: 'Germany',
    concert_date: '2026-09-10T19:00:00Z',
    ticket_url: 'https://tickets.example.com',
    songkick_id: 'sk-2',
    status: 'ok',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
]

describe('getConcerts', () => {
  it('returns an empty array when no concerts exist', async () => {
    const db = makeMockDb([])
    await expect(getConcerts(db)).resolves.toEqual([])
  })

  it('maps rows and sorts with status ok first', async () => {
    const db = makeMockDb(mockConcerts)
    const result = await getConcerts(db)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('concert-ok')
    expect(result[0].artistName).toBe('Artist B')
    expect(result[1].id).toBe('concert-cancelled')
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'Concert query failed', code: 'PGRST001' })
    await expect(getConcerts(db)).rejects.toThrow('Concert query failed')
  })
})
