import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { hasPortalArtistMembership } from './membership'

type DbClient = SupabaseClient<Database>

function makeMockDb(data: unknown, error: unknown = null): DbClient {
  const result = { data, error }
  const p = Promise.resolve(result)
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
  return { from: vi.fn().mockReturnValue(builder) } as unknown as DbClient
}

describe('hasPortalArtistMembership', () => {
  it('returns true when a membership row exists', async () => {
    const db = makeMockDb({ artist_id: 'artist-uuid' })
    await expect(hasPortalArtistMembership(db, 'user-uuid')).resolves.toBe(true)
  })

  it('returns false when no membership exists', async () => {
    const db = makeMockDb(null)
    await expect(hasPortalArtistMembership(db, 'user-uuid')).resolves.toBe(false)
  })

  it('throws on database errors', async () => {
    const db = makeMockDb(null, { message: 'DB failure' })
    await expect(hasPortalArtistMembership(db, 'user-uuid')).rejects.toThrow('DB failure')
  })
})