import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getSyncLogsByArtist, insertSyncLog } from './syncLogs'

type DbClient = SupabaseClient<Database>
type SyncLogRow = Database['public']['Tables']['sync_logs']['Row']

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeMockDb(data: unknown = null, error: unknown = null): DbClient {
  return { from: vi.fn().mockReturnValue(makeBuilder(data, error)) } as unknown as DbClient
}

const mockRow: SyncLogRow = {
  id: 'log-1',
  artist_id: 'artist-1',
  status: 'success',
  message: 'Synced 3 releases',
  releases_synced: 3,
  errors: [],
  api_source: 'itunes',
  rate_limited: false,
  duration_ms: 1200,
  metadata: { source: 'itunes' },
  created_at: '2024-01-01T00:00:00Z',
}

describe('getSyncLogsByArtist', () => {
  it('returns mapped SyncLog domain objects', async () => {
    const db = makeMockDb([mockRow])
    const result = await getSyncLogsByArtist(db, 'artist-1')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'log-1',
      artistId: 'artist-1',
      status: 'success',
      message: 'Synced 3 releases',
      releasesSynced: 3,
      errors: [],
      apiSource: 'itunes',
      rateLimited: false,
      durationMs: 1200,
      metadata: { source: 'itunes' },
      createdAt: '2024-01-01T00:00:00Z',
    })
  })

  it('maps null artist_id to empty string', async () => {
    const rowWithNullArtist: SyncLogRow = { ...mockRow, artist_id: null }
    const db = makeMockDb([rowWithNullArtist])
    const result = await getSyncLogsByArtist(db, '')
    expect(result[0].artistId).toBe('')
  })

  it('returns empty array when data is null', async () => {
    const db = makeMockDb(null)
    const result = await getSyncLogsByArtist(db, 'artist-1')
    expect(result).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    const db = makeMockDb(null, { message: 'DB error' })
    await expect(getSyncLogsByArtist(db, 'artist-1')).rejects.toThrow('DB error')
  })
})

describe('insertSyncLog', () => {
  it('returns the inserted SyncLog on success', async () => {
    const db = makeMockDb(mockRow)
    const result = await insertSyncLog(db, {
      artist_id: 'artist-1',
      status: 'success',
      message: 'Synced 3 releases',
      releases_synced: 3,
      errors: [],
      api_source: 'itunes',
      rate_limited: false,
    })
    expect(result.id).toBe('log-1')
    expect(result.status).toBe('success')
  })

  it('throws when Supabase returns an error', async () => {
    const db = makeMockDb(null, { message: 'Insert failed' })
    await expect(
      insertSyncLog(db, { status: 'error', api_source: 'itunes' }),
    ).rejects.toThrow('Insert failed')
  })

  it('throws when data is null (unexpected response)', async () => {
    const db = makeMockDb(null, null)
    await expect(
      insertSyncLog(db, { status: 'success', api_source: 'itunes' }),
    ).rejects.toThrow('No data returned from insertSyncLog')
  })
})
