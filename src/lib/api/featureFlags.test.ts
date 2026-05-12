import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getFeatureFlags, updateFeatureFlag } from './featureFlags'

type DbClient = SupabaseClient<Database>

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
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

describe('featureFlags DAL', () => {
  it('maps flags', async () => {
    const db = makeMockDb([{ id: 'artist.tour', label: 'Tour', enabled: true, target_role: 'artist', updated_at: '2026-01-01T00:00:00Z' }])
    const flags = await getFeatureFlags(db)
    expect(flags[0]).toMatchObject({ id: 'artist.tour', enabled: true, targetRole: 'artist' })
  })

  it('updates flag', async () => {
    const db = makeMockDb({ id: 'artist.tour', label: 'Tour', enabled: false, target_role: 'artist', updated_at: '2026-01-01T00:00:00Z' })
    const flag = await updateFeatureFlag(db, 'artist.tour', false)
    expect(flag.enabled).toBe(false)
  })
})
