import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  deleteCredential,
  listCredentialStatus,
  upsertCredential,
} from './apiCredentials'

const TEST_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

function createMockDb(rows: Array<Record<string, unknown>> = []) {
  const store = [...rows]

  return {
    from: vi.fn((table: string) => {
      if (table !== 'api_credentials') {
        throw new Error(`Unexpected table: ${table}`)
      }

      const api = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(function (this: typeof api) {
          return this
        }),
        maybeSingle: vi.fn(async () => {
          const row = store[0] ?? null
          return { data: row, error: null }
        }),
        upsert: vi.fn(async (payload: Record<string, unknown>) => {
          const idx = store.findIndex(
            (row) => row.key === payload.key && row.label_id === (payload.label_id ?? null),
          )
          const next = { ...payload, updated_at: new Date().toISOString() }
          if (idx >= 0) store[idx] = next
          else store.push(next)
          return { error: null }
        }),
        delete: vi.fn(() => ({
          eq: vi.fn((_col: string, keyVal: string) => ({
            is: vi.fn(async (_labelCol: string, labelVal: null) => {
              const idx = store.findIndex(
                (row) => row.key === keyVal && (row.label_id ?? null) === labelVal,
              )
              if (idx >= 0) store.splice(idx, 1)
              return { error: null }
            }),
          })),
        })),
        then: undefined as unknown,
      }
      const chain = {
        ...api,
        then(onFulfilled: (value: { data: typeof store; error: null }) => unknown) {
          return Promise.resolve({ data: store, error: null }).then(onFulfilled)
        },
      }
      return chain
    }),
    _store: store,
  } as unknown as SupabaseClient<Database> & { _store: Array<Record<string, unknown>> }
}

describe('apiCredentials DAL', () => {
  beforeEach(() => {
    vi.stubEnv('API_CREDENTIALS_ENCRYPTION_KEY', TEST_KEY_HEX)
  })

  it('lists all defined keys with configured=false when empty', async () => {
    const db = createMockDb()
    const status = await listCredentialStatus(db)
    expect(status.length).toBeGreaterThan(10)
    expect(status.every((row) => row.configured === false)).toBe(true)
  })

  it('encrypts value on upsert', async () => {
    const db = createMockDb()
    await upsertCredential(db, {
      key: 'discogs_token',
      value: 'my-discogs-token',
      updatedBy: 'admin-1',
    })

    const stored = db._store[0]
    expect(stored?.value).toMatch(/^v1:/)
    expect(stored?.value).not.toContain('my-discogs-token')
  })

  it('deletes credential row', async () => {
    const db = createMockDb([
      {
        label_id: null,
        key: 'discogs_token',
        value: 'v1:iv:tag:data',
        updated_at: '',
        updated_by: null,
      },
    ])
    await deleteCredential(db, 'discogs_token')
    expect(db._store).toHaveLength(0)
  })
})