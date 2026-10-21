import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { insertSyncLog, recordSyncLog } from './syncLogs'

const { mockWriteAppLog } = vi.hoisted(() => ({ mockWriteAppLog: vi.fn(async () => true) }))

vi.mock('@/lib/appLog', () => ({ writeAppLog: mockWriteAppLog }))

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

describe('recordSyncLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true and does not write an app log on success', async () => {
    const db = makeMockDb(mockRow)
    const ok = await recordSyncLog(db, { status: 'success', api_source: 'itunes' })
    expect(ok).toBe(true)
    expect(mockWriteAppLog).not.toHaveBeenCalled()
  })

  it('skips insert and returns true for success with zero releases synced', async () => {
    const db = makeMockDb(mockRow)
    const ok = await recordSyncLog(db, { status: 'success', api_source: 'itunes', releases_synced: 0 })
    expect(ok).toBe(true)
    expect(db.from).not.toHaveBeenCalled()
    expect(mockWriteAppLog).not.toHaveBeenCalled()
  })

  it('still inserts success logs when releases were synced', async () => {
    const db = makeMockDb(mockRow)
    const ok = await recordSyncLog(db, { status: 'success', api_source: 'itunes', releases_synced: 3 })
    expect(ok).toBe(true)
    expect(db.from).toHaveBeenCalledWith('sync_logs')
    expect(mockWriteAppLog).not.toHaveBeenCalled()
  })

  it('returns false and reports the failure to app_logs when the insert fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = makeMockDb(null, { message: 'column metadata does not exist' })

    const ok = await recordSyncLog(db, { status: 'error', api_source: 'itunes' })

    expect(ok).toBe(false)
    expect(mockWriteAppLog).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'sync',
        level: 'error',
        message: expect.stringContaining('itunes'),
      }),
    )
    consoleSpy.mockRestore()
  })
})
