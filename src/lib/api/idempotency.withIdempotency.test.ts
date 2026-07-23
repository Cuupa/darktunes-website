import { describe, it, expect, vi } from 'vitest'
import { withIdempotency } from './idempotency'

function mockDb(opts: {
  claimOk: boolean
  existingResourceId?: string | null
}) {
  const insert = vi.fn().mockReturnValue({
    select: () => ({
      single: async () =>
        opts.claimOk
          ? { data: { key: 'k' }, error: null }
          : { data: null, error: { code: '23505', message: 'duplicate key' } },
    }),
  })
  const del = vi.fn().mockReturnValue({
    eq: async () => ({ error: null }),
  })
  const update = vi.fn().mockReturnValue({
    eq: async () => ({ error: null }),
  })
  const select = vi.fn().mockReturnValue({
    eq: () => ({
      maybeSingle: async () => ({
        data: opts.claimOk
          ? null
          : { resource_type: 'submit-video', resource_id: opts.existingResourceId ?? null },
        error: null,
      }),
    }),
  })

  return {
    from: (table: string) => {
      if (table !== 'idempotency_keys') throw new Error(`unexpected table ${table}`)
      return {
        insert,
        delete: () => ({ lt: async () => ({ error: null }), eq: del().eq }),
        update: () => update(),
        select,
      }
    },
  }
}

describe('withIdempotency', () => {
  it('runs work when claim succeeds', async () => {
    const db = mockDb({ claimOk: true }) as never
    const result = await withIdempotency(db, 'uuid-1', 'submit-video', async () => ({
      id: 'sub-1',
    }))
    expect(result).toEqual({ status: 'ok', value: { id: 'sub-1' } })
  })

  it('returns duplicate with resource id when claim fails', async () => {
    const db = mockDb({ claimOk: false, existingResourceId: 'sub-old' }) as never
    const result = await withIdempotency(db, 'uuid-2', 'submit-video', async () => ({
      id: 'never',
    }))
    expect(result).toEqual({ status: 'duplicate', resourceId: 'sub-old' })
  })
})
