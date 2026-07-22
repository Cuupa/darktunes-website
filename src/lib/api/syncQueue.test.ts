import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  recoverStuckSyncJobs,
  requeueFailedSyncJobs,
  enqueueArtistSyncJobs,
  markSyncJobFailed,
  markSyncJobDone,
  countStuckSyncJobs,
  conflictingArtistJobTypes,
  getSyncQueueStats,
  tryAcquireSyncExecutorLease,
  releaseSyncExecutorLease,
  SYNC_EXECUTOR_LEASE_KEY,
  MAX_ATTEMPTS,
} from './syncQueue'

type DbClient = SupabaseClient<Database>
function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    gte: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeSequentialMockDb(calls: Array<{ data: unknown; error?: unknown }>): DbClient {
  let callIndex = 0
  return {
    from: vi.fn().mockImplementation(() => {
      const call = calls[callIndex] ?? { data: null, error: null }
      callIndex++
      return makeBuilder(call.data, call.error ?? null)
    }),
  } as unknown as DbClient
}

describe('tryAcquireSyncExecutorLease', () => {
  it('acquires when no lease row exists', async () => {
    const db = makeSequentialMockDb([{ data: null }, { data: null }])
    await expect(tryAcquireSyncExecutorLease(db, 60_000)).resolves.toBe(true)
    expect(db.from).toHaveBeenCalledWith('site_settings')
  })

  it('returns false when lease is still valid', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const db = makeSequentialMockDb([{ data: { value: future } }])
    await expect(tryAcquireSyncExecutorLease(db, 60_000)).resolves.toBe(false)
  })

  it('acquires when lease is expired via optimistic update', async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    const db = makeSequentialMockDb([
      { data: { value: past } },
      { data: [{ key: SYNC_EXECUTOR_LEASE_KEY }] },
    ])
    await expect(tryAcquireSyncExecutorLease(db, 60_000)).resolves.toBe(true)
  })
})

describe('releaseSyncExecutorLease', () => {
  it('upserts expired lease value', async () => {
    const db = makeSequentialMockDb([{ data: null }])
    await expect(releaseSyncExecutorLease(db)).resolves.toBeUndefined()
    expect(db.from).toHaveBeenCalledWith('site_settings')
  })
})

describe('countStuckSyncJobs', () => {
  it('returns the number of stuck running jobs', async () => {
    const db = makeSequentialMockDb([{ data: [{ id: 'job-9' }] }])
    const count = await countStuckSyncJobs(db)
    expect(count).toBe(1)
  })
})

describe('recoverStuckSyncJobs', () => {
  it('returns the number of recovered jobs', async () => {
    const db = makeSequentialMockDb([{ data: [{ id: 'job-1' }, { id: 'job-2' }] }])
    const count = await recoverStuckSyncJobs(db)
    expect(count).toBe(2)
  })

  it('throws when Supabase returns an error', async () => {
    const db = makeSequentialMockDb([{ data: null, error: { message: 'update failed' } }])
    await expect(recoverStuckSyncJobs(db)).rejects.toThrow('Failed to recover stuck sync jobs')
  })
})

describe('requeueFailedSyncJobs', () => {
  it('returns the number of re-queued jobs', async () => {
    const db = makeSequentialMockDb([{ data: [{ id: 'job-3' }] }])
    const count = await requeueFailedSyncJobs(db)
    expect(count).toBe(1)
  })
})

describe('conflictingArtistJobTypes', () => {
  it('treats full jobs as blocking any artist-scoped sync', () => {
    expect(conflictingArtistJobTypes('full')).toEqual(['full', 'spotify', 'discogs', 'youtube'])
  })

  it('allows spotify enqueue when only discogs is pending', () => {
    expect(conflictingArtistJobTypes('spotify')).toEqual(['full', 'spotify'])
    expect(conflictingArtistJobTypes('spotify')).not.toContain('discogs')
  })
})

describe('enqueueArtistSyncJobs', () => {
  it('skips artists that already have pending or running jobs', async () => {
    const db = makeSequentialMockDb([
      { data: [{ artist_id: 'artist-1' }] },
      { data: null },
    ])
    const count = await enqueueArtistSyncJobs(db, ['artist-1', 'artist-2'])
    expect(count).toBe(1)
  })

  it('returns 0 when all artists are already queued', async () => {
    const db = makeSequentialMockDb([{ data: [{ artist_id: 'artist-1' }] }])
    const count = await enqueueArtistSyncJobs(db, ['artist-1'])
    expect(count).toBe(0)
  })

  it('returns 0 for an empty artist list', async () => {
    const db = makeSequentialMockDb([])
    const count = await enqueueArtistSyncJobs(db, [])
    expect(count).toBe(0)
  })
})

describe('markSyncJobDone', () => {
  it('clears locked_until on completion', async () => {
    const db = makeSequentialMockDb([{ data: null }])
    await expect(markSyncJobDone(db, 'job-1')).resolves.toBeUndefined()
    expect(db.from).toHaveBeenCalledWith('sync_queue')
  })
})

describe('markSyncJobFailed', () => {
  it('re-queues with backoff when attempts remain', async () => {
    const db = makeSequentialMockDb([{ data: null }])
    await markSyncJobFailed(db, 'job-1', 'timeout', 1)
    expect(db.from).toHaveBeenCalledWith('sync_queue')
  })

  it('marks permanently failed when max attempts reached', async () => {
    const db = makeSequentialMockDb([{ data: null }])
    await markSyncJobFailed(db, 'job-1', 'fatal', MAX_ATTEMPTS)
    expect(db.from).toHaveBeenCalledWith('sync_queue')
  })

  it('re-queues rate-limited jobs without exhausting max attempts', async () => {
    const db = makeSequentialMockDb([{ data: null }])
    await markSyncJobFailed(db, 'job-1', '429', MAX_ATTEMPTS, { rateLimited: true })
    expect(db.from).toHaveBeenCalledWith('sync_queue')
  })
})

describe('getSyncQueueStats', () => {
  it('aggregates per-status counts via head queries', async () => {
    const db = makeSequentialMockDb([
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ])

    let callIndex = 0
    const counts = [3, 1, 10, 2]
    const gteCalls: string[] = []
    ;(db.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const count = counts[callIndex] ?? 0
      callIndex++
      const countResult = { count, error: null }
      const countPromise = Promise.resolve(countResult)
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn((field: string) => {
          gteCalls.push(field)
          return {
            then: countPromise.then.bind(countPromise),
            catch: countPromise.catch.bind(countPromise),
            finally: countPromise.finally.bind(countPromise),
          }
        }),
        then: countPromise.then.bind(countPromise),
        catch: countPromise.catch.bind(countPromise),
        finally: countPromise.finally.bind(countPromise),
      }
    })

    const stats = await getSyncQueueStats(db)
    expect(stats).toEqual({ pending: 3, running: 1, done: 10, failed: 2 })
    expect(db.from).toHaveBeenCalledTimes(4)
    expect(gteCalls).toEqual(['created_at', 'created_at'])
  })
})