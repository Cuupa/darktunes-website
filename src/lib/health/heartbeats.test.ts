import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getHealthHeartbeats, recordHealthHeartbeat } from './heartbeats'

function makeDb(
  opts: { failRead?: boolean; insertError?: unknown } = {},
): SupabaseClient<Database> {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(
        opts.failRead
          ? { data: null, error: { message: 'boom' } }
          : { data: { created_at: '2026-09-20T00:00:00.000Z' }, error: null },
      ),
      insert: vi.fn().mockResolvedValue({ error: opts.insertError ?? null }),
    })),
  } as unknown as SupabaseClient<Database>
}

describe('getHealthHeartbeats', () => {
  it('returns the latest tick per kind', async () => {
    const heartbeats = await getHealthHeartbeats(makeDb())
    expect(heartbeats.worker).toBe('2026-09-20T00:00:00.000Z')
    expect(heartbeats.scheduler).toBe('2026-09-20T00:00:00.000Z')
  })

  it('never throws when a kind read fails (telemetry must not break health)', async () => {
    const heartbeats = await getHealthHeartbeats(makeDb({ failRead: true }))
    expect(heartbeats).toEqual({
      scheduler: null,
      worker: null,
      queue: null,
      youtube: null,
      health_alert: null,
    })
  })
})

describe('recordHealthHeartbeat', () => {
  it('inserts a tick and never throws on error', async () => {
    await expect(
      recordHealthHeartbeat(makeDb({ insertError: { message: 'nope' } }), 'worker'),
    ).resolves.toBeUndefined()
  })
})
