import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { importCredentialsFromEnv } from './importCredentialsFromEnv'

const TEST_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

function createMockDb(rows: Array<Record<string, unknown>> = []) {
  const store = [...rows]

  return {
    from: vi.fn((table: string) => {
      if (table !== 'api_credentials') {
        throw new Error(`Unexpected table: ${table}`)
      }

      const filters: { key?: string; labelIdIsNull?: boolean } = {}

      const api = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn(function (this: typeof api, column: string, value: string) {
          if (column === 'key') filters.key = value
          return this
        }),
        is: vi.fn(function (this: typeof api, column: string, value: null) {
          if (column === 'label_id' && value === null) filters.labelIdIsNull = true
          return this
        }),
        maybeSingle: vi.fn(async () => {
          const row = store.find((entry) => {
            if (filters.key && entry.key !== filters.key) return false
            if (filters.labelIdIsNull && entry.label_id !== null) return false
            return true
          })
          return { data: row ?? null, error: null }
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
          eq: vi.fn(() => ({
            is: vi.fn(async () => ({ error: null })),
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

describe('importCredentialsFromEnv', () => {
  beforeEach(() => {
    vi.stubEnv('API_CREDENTIALS_ENCRYPTION_KEY', TEST_KEY_HEX)
  })

  it('imports credentials present in env and reports missing ones', async () => {
    const db = createMockDb()
    const env: Record<string, string> = {
      SPOTIFY_CLIENT_ID: 'spotify-id',
      SPOTIFY_CLIENT_SECRET: 'spotify-secret',
      DISCOGS_TOKEN: 'discogs-token',
    }

    const result = await importCredentialsFromEnv(db, 'admin-1', {
      readEnv: (name) => env[name],
    })

    expect(result.imported).toEqual([
      'spotify_client_id',
      'spotify_client_secret',
      'discogs_token',
    ])
    expect(result.skipped.some((s) => s.key === 'songkick_api_key' && s.reason === 'env_missing')).toBe(
      true,
    )
    expect(result.envVarsChecked.find((e) => e.envVar === 'SPOTIFY_CLIENT_ID')?.present).toBe(true)
    expect(result.envVarsChecked.find((e) => e.envVar === 'SONGKICK_API_KEY')?.present).toBe(false)
    expect(db._store).toHaveLength(3)
  })

  it('skips keys that already decrypt to a non-empty value', async () => {
    const db = createMockDb()
    const env: Record<string, string> = { DISCOGS_TOKEN: 'legacy-value' }

    await importCredentialsFromEnv(db, 'admin-1', { readEnv: (name) => env[name] })
    const second = await importCredentialsFromEnv(db, 'admin-1', { readEnv: (name) => env[name] })

    expect(second.imported).not.toContain('discogs_token')
    expect(second.skipped).toContainEqual({
      key: 'discogs_token',
      envVar: 'DISCOGS_TOKEN',
      reason: 'already_configured',
    })
  })
})