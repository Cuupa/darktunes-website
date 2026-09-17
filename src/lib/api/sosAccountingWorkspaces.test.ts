import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  upsertWorkspaceForPeriod,
  WorkspaceRevisionConflictError,
} from './sosAccountingWorkspaces'

function workspaceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ws-1',
    period_start: '2026-01-01',
    period_end: '2026-03-31',
    config: {},
    bronze_batch_ids: [],
    revision: 1,
    updated_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeInsertClient(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  const client = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient<Database>
  return { client, insert }
}

function makeUpdateClient(result: { data: unknown; error: unknown }) {
  const select = vi.fn().mockResolvedValue(result)
  const eqRevision = vi.fn(() => ({ select }))
  const eqEnd = vi.fn(() => ({ eq: eqRevision }))
  const eqStart = vi.fn(() => ({ eq: eqEnd }))
  const update = vi.fn(() => ({ eq: eqStart }))
  const client = { from: vi.fn(() => ({ update })) } as unknown as SupabaseClient<Database>
  return { client, update, eqRevision }
}

describe('upsertWorkspaceForPeriod revision contract (#617)', () => {
  it('inserts revision 1 when the client saw no workspace', async () => {
    const { client, insert } = makeInsertClient({ data: workspaceRow(), error: null })

    const result = await upsertWorkspaceForPeriod(client, {
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      config: {} as never,
      expectedRevision: null,
    })

    expect(result.revision).toBe(1)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        revision: 1,
      }),
    )
  })

  it('updates with revision + 1 guarded by the expected revision', async () => {
    const { client, update, eqRevision } = makeUpdateClient({
      data: [workspaceRow({ revision: 4 })],
      error: null,
    })

    const result = await upsertWorkspaceForPeriod(client, {
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      config: {} as never,
      expectedRevision: 3,
    })

    expect(result.revision).toBe(4)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ revision: 4 }))
    expect(eqRevision).toHaveBeenCalledWith('revision', 3)
  })

  it('throws a conflict when the guarded update matches no row', async () => {
    const { client } = makeUpdateClient({ data: [], error: null })

    await expect(
      upsertWorkspaceForPeriod(client, {
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        config: {} as never,
        expectedRevision: 2,
      }),
    ).rejects.toBeInstanceOf(WorkspaceRevisionConflictError)
  })

  it('throws a conflict when a concurrent insert wins the unique constraint', async () => {
    const { client } = makeInsertClient({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    })

    await expect(
      upsertWorkspaceForPeriod(client, {
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        config: {} as never,
        expectedRevision: null,
      }),
    ).rejects.toBeInstanceOf(WorkspaceRevisionConflictError)
  })
})
