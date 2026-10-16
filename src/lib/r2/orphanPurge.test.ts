import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { purgeOrphanObjects } from '@/lib/r2/orphanPurge'

const { deleteObjectFromR2, getLatestStorageSnapshot, collectReferencedKeys } = vi.hoisted(() => ({
  deleteObjectFromR2: vi.fn(),
  getLatestStorageSnapshot: vi.fn(),
  collectReferencedKeys: vi.fn(),
}))

vi.mock('@/lib/r2Utils', () => ({ deleteObjectFromR2 }))
vi.mock('@/lib/r2/storageScan', () => ({ getLatestStorageSnapshot }))
vi.mock('@/lib/r2/referencedKeys', () => ({ collectReferencedKeys }))

type OrphanRow = {
  id: string
  object_key: string
  size_bytes: number
  last_modified: string | null
}

const OLD = '2020-01-01T00:00:00.000Z'

function makeSnapshot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'snap-1',
    status: 'completed',
    orphan_count: 3,
    orphan_bytes: 300,
    used_bytes: 1000,
    object_count: 10,
    ...overrides,
  }
}

/** Minimal PostgREST-shaped mock: list, delete, count-head and update. */
function makeDb(orphans: OrphanRow[], remaining: number) {
  const updatePatches: Record<string, unknown>[] = []
  const deletedIdCalls: string[][] = []

  const builder = () => {
    const state: {
      op: string | null
      patch: Record<string, unknown> | null
      ids: string[] | null
      countHead: boolean
    } = { op: null, patch: null, ids: null, countHead: false }

    const chain: Record<string, unknown> = {
      select: (_cols?: unknown, opts?: { head?: boolean }) => {
        state.op = 'select'
        if (opts?.head) state.countHead = true
        return chain
      },
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      in: (_col: string, ids: string[]) => {
        state.ids = ids
        return chain
      },
      delete: () => {
        state.op = 'delete'
        return chain
      },
      update: (patch: Record<string, unknown>) => {
        state.op = 'update'
        state.patch = patch
        updatePatches.push(patch)
        return chain
      },
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
        let result: Record<string, unknown>
        if (state.op === 'delete') {
          deletedIdCalls.push(state.ids ?? [])
          result = { error: null }
        } else if (state.op === 'update') {
          result = { error: null }
        } else if (state.countHead) {
          result = { count: remaining, error: null }
        } else {
          result = { data: orphans, error: null }
        }
        return Promise.resolve(result).then(resolve, reject)
      },
    }
    return chain
  }

  const db = { from: vi.fn(() => builder()) } as unknown as SupabaseClient<Database>
  return { db, updatePatches, deletedIdCalls }
}

const s3 = {} as never
const baseOptions = () => ({ db: null as never, s3, bucket: 'bucket', publicUrl: 'https://cdn.example.com' })

beforeEach(() => {
  vi.clearAllMocks()
  getLatestStorageSnapshot.mockResolvedValue(makeSnapshot())
  collectReferencedKeys.mockResolvedValue(new Set<string>())
  deleteObjectFromR2.mockResolvedValue(undefined)
})

describe('purgeOrphanObjects', () => {
  it('deletes aged unreferenced objects, skips referenced ones, and keeps stats consistent', async () => {
    const orphans: OrphanRow[] = [
      { id: 'o1', object_key: 'a.jpg', size_bytes: 100, last_modified: OLD },
      { id: 'o2', object_key: 'b.jpg', size_bytes: 200, last_modified: OLD },
      { id: 'o3', object_key: 'c.jpg', size_bytes: 50, last_modified: OLD },
    ]
    collectReferencedKeys.mockResolvedValue(new Set(['b.jpg']))
    const { db, updatePatches, deletedIdCalls } = makeDb(orphans, 1)

    const result = await purgeOrphanObjects({ ...baseOptions(), db })

    expect(result).toEqual({ deleted: 2, skipped: 1, failed: 0, remaining: 1 })
    expect(deleteObjectFromR2).toHaveBeenCalledWith('a.jpg', s3, 'bucket')
    expect(deleteObjectFromR2).toHaveBeenCalledWith('c.jpg', s3, 'bucket')
    expect(deleteObjectFromR2).not.toHaveBeenCalledWith('b.jpg', s3, 'bucket')
    // skipped + deleted rows are all resolved out of the orphan table
    expect(deletedIdCalls).toEqual([['o1', 'o2', 'o3']])
    expect(updatePatches[0]).toEqual({
      orphan_count: 1,
      orphan_bytes: 150,
      used_bytes: 850,
      object_count: 8,
    })
  })

  it('keeps the row and counts a failed S3 delete instead of aborting the batch', async () => {
    const orphans: OrphanRow[] = [
      { id: 'o1', object_key: 'a.jpg', size_bytes: 100, last_modified: OLD },
    ]
    deleteObjectFromR2.mockRejectedValueOnce(new Error('s3 down'))
    const { db, updatePatches, deletedIdCalls } = makeDb(orphans, 1)

    const result = await purgeOrphanObjects({ ...baseOptions(), db })

    expect(result).toEqual({ deleted: 0, skipped: 0, failed: 1, remaining: 1 })
    // The failed row is not removed, so it is retried on the next batch.
    expect(deletedIdCalls).toHaveLength(0)
    expect(updatePatches[0]).toMatchObject({ orphan_count: 1, orphan_bytes: 300, object_count: 10 })
  })

  it('throws when there is no completed scan', async () => {
    getLatestStorageSnapshot.mockResolvedValue(null)
    const { db } = makeDb([], 0)
    await expect(purgeOrphanObjects({ ...baseOptions(), db })).rejects.toThrow(
      'No completed storage scan',
    )
  })
})
