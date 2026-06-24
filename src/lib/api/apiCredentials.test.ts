import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  DEFAULT_LABEL_ID,
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
        eq: vi.fn(function (this: typeof api, col: string, val: unknown) {
          if (col === 'label_id') {
            this._labelId = val
          }
          if (col === 'key') {
            this._key = val
          }
          return this
        }),
        maybeSingle: vi.fn(async function (this: { _labelId?: unknown; _key?: unknown }) {
          const row =
            store.find(
              (r) =>
                r.label_id === (this._labelId ?? DEFAULT_LABEL_ID) &&
                (this._key === undefined || r.key === this._key),
            ) ?? null
          return { data: row, error: null }
        }),
        upsert: vi.fn(async (payload: Record<string, unknown>) => {
          const labelId = payload.label_id ?? DEFAULT_LABEL_ID
          const idx = store.findIndex(
            (row) => row.key === payload.key && row.label_id === labelId,
          )
          const next = { ...payload, label_id: labelId, updated_at: new Date().toISOString() }
          if (idx >= 0) store[idx] = next
          else store.push(next)
          return { error: null }
        }),
        delete: vi.fn(function (this: typeof api) {
          return {
            eq: vi.fn(function (this: { _key?: unknown; _labelId?: unknown }, col: string, val: unknown) {
              if (col === 'key') this._key = val
              if (col === 'label_id') this._labelId = val
              return {
                eq: vi.fn(async function (
                  this: { _key?: unknown; _labelId?: unknown },
                  col2: string,
                  val2: unknown,
                ) {
                  if (col2 === 'label_id') this._labelId = val2
                  const idx = store.findIndex(
                    (row) =>
                      row.key === this._key &&
                      row.label_id === (this._labelId ?? DEFAULT_LABEL_ID),
                  )
                  if (idx >= 0) store.splice(idx, 1)
                  return { error: null }
                }).bind(this),
              }
            }).bind(this),
          }
        }),
        _labelId: undefined as unknown,
        _key: undefined as unknown,
        then: undefined as unknown,
      }
      const chain = {
        ...api,
        then(onFulfilled: (value: { data: typeof store; error: null }) => unknown) {
          const labelId = api._labelId ?? DEFAULT_LABEL_ID
          const filtered = store.filter((row) => row.label_id === labelId)
          return Promise.resolve({ data: filtered, error: null }).then(onFulfilled)
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

  it('uses sentinel label_id for default tenant', () => {
    expect(DEFAULT_LABEL_ID).toBe('00000000-0000-0000-0000-000000000000')
  })

  it('lists all defined keys with configured=false when empty', async () => {
    const db = createMockDb()
    const status = await listCredentialStatus(db)
    expect(status.length).toBeGreaterThan(10)
    expect(status.every((row) => row.configured === false)).toBe(true)
  })

  it('encrypts value on upsert with default label_id', async () => {
    const db = createMockDb()
    await upsertCredential(db, {
      key: 'discogs_token',
      value: 'my-discogs-token',
      updatedBy: 'admin-1',
    })

    const stored = db._store[0]
    expect(stored?.label_id).toBe(DEFAULT_LABEL_ID)
    expect(stored?.value).toMatch(/^v1:/)
    expect(stored?.value).not.toContain('my-discogs-token')
  })

  it('deletes credential row', async () => {
    const db = createMockDb([
      {
        label_id: DEFAULT_LABEL_ID,
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