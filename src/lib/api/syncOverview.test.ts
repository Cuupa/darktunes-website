import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getSyncOverview } from './syncOverview'

function makeDb(artists: Array<{ id: string; name: string }>, states: unknown[] = []) {
  const builder = (data: unknown) => ({
    select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
    then: Promise.resolve({ data, error: null }).then.bind(Promise.resolve({ data, error: null })),
  })
  const artistQuery = builder(artists)
  const stateQuery = builder(states)
  const db = { from: vi.fn((table: string) => table === 'artists' ? artistQuery : table === 'sync_artist_state' ? stateQuery : builder([])) }
  return { db: db as unknown as SupabaseClient<Database>, artistQuery, stateQuery }
}

describe('getSyncOverview', () => {
  it('includes artists without checkpoints and pages artists without losing provider rows', async () => {
    const { db, stateQuery } = makeDb([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }], [
      { artist_id: 'a', provider: 'itunes', last_status: 'success' },
      { artist_id: 'a', provider: 'spotify', last_status: 'cooldown' },
    ])
    const result = await getSyncOverview(db, 2)
    expect(result.items).toHaveLength(2)
    expect(result.items[0].states).toHaveLength(2)
    expect(result.items[1].states).toEqual([])
    expect(result.next_cursor).toBe('b')
    expect(stateQuery.in).toHaveBeenCalledWith('artist_id', ['a', 'b'])
  })

  it('uses a keyset cursor and avoids a state scan on an empty page', async () => {
    const { db, artistQuery, stateQuery } = makeDb([])
    const result = await getSyncOverview(db, 25, 'last-artist')
    expect(artistQuery.gt).toHaveBeenCalledWith('id', 'last-artist')
    expect(result.items).toEqual([])
    expect(result.next_cursor).toBeNull()
    expect(stateQuery.select).not.toHaveBeenCalled()
  })
})
