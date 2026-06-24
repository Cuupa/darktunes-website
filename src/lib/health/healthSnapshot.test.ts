import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildHealthSnapshot } from './healthSnapshot'
import type { Database } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

const NOW_MS = new Date('2026-06-23T12:00:00.000Z').getTime()

const RECENT_LOG = {
  api_source: 'itunes',
  created_at: '2026-06-23T11:00:00.000Z',
  status: 'success',
  rate_limited: false,
  errors: [],
  duration_ms: 900,
  releases_synced: 2,
  metadata: {},
}

function makeThenableBuilder(data: unknown, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
  return builder
}

function createMockDb(): SupabaseClient<Database> {
  return {
    from: vi.fn((table: string) => {
      if (table === 'site_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      if (table === 'sync_logs') {
        return makeThenableBuilder([RECENT_LOG])
      }
      if (table === 'api_credentials') {
        return makeThenableBuilder([])
      }
      if (table === 'sync_queue') {
        return {
          select: vi.fn((fields: string) =>
            makeThenableBuilder(
              fields === 'id' ? [] : [{ status: 'done' }, { status: 'pending' }],
            ),
          ),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        }
      }
      return makeThenableBuilder(null)
    }),
  } as unknown as SupabaseClient<Database>
}

describe('buildHealthSnapshot', () => {
  beforeEach(() => {
    vi.stubEnv('API_CREDENTIALS_ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')
  })

  it('returns unavailable APIs when db is null', async () => {
    const snapshot = await buildHealthSnapshot({ db: null, nowMs: NOW_MS })
    expect(snapshot.database.status).toBe('offline')
    expect(snapshot.apis.itunes.operationalState).toBe('unavailable')
    expect(snapshot.healthScore).toBe(0)
    expect(snapshot.alerts.length).toBeGreaterThan(0)
  })

  it('builds full snapshot when db is online', async () => {
    const snapshot = await buildHealthSnapshot({
      db: createMockDb(),
      knownApis: { itunes: true, odesli: true },
      nowMs: NOW_MS,
    })

    expect(snapshot.database.status).toBe('online')
    expect(snapshot.apis.itunes.operationalState).toBe('operational')
    expect(snapshot.apis.itunes.stats24h.total).toBe(1)
    expect(snapshot.apis.itunes.stats24h.successRate).toBe(100)
    expect(snapshot.healthScore).toBeGreaterThan(0)
    expect(snapshot.kpis.configuredApis).toBe(2)
    expect(snapshot.syncQueue).not.toBeNull()
    expect(snapshot.cronHealth).not.toBeNull()
    expect(snapshot.checkedAt).toBeTruthy()
  })

  it('queries sync_logs twice (ping + lookback)', async () => {
    const db = createMockDb()
    await buildHealthSnapshot({ db, nowMs: NOW_MS })

    const fromCalls = (db.from as ReturnType<typeof vi.fn>).mock.calls
    const syncLogsCall = fromCalls.filter(([t]) => t === 'sync_logs')
    expect(syncLogsCall.length).toBeGreaterThanOrEqual(2)
  })
})