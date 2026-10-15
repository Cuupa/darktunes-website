import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
const privateRow = {
  stop_id: 'stop-1',
  artist_id: 'artist-1',
  deal: null,
  settlement: null,
  private_notes: 'secret',
  version: 2,
  updated_at: '2026-06-01T12:00:00Z',
}

function makeDb(existing: typeof privateRow | null) {
  const chain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
    upsert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { ...privateRow, private_notes: 'updated', version: 3 }, error: null }),
  }
  return {
    from: vi.fn(() => chain),
    chain,
  } as unknown as SupabaseClient<Database>
}

describe('tourStopPrivate', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('throws 409 when expectedUpdatedAt mismatches', async () => {
    const db = makeDb(privateRow)
    const { upsertStopPrivateData } = await import('@/lib/api/tourStopPrivate')
    await expect(
      upsertStopPrivateData(db, 'stop-1', 'artist-1', { privateNotes: 'x' }, '2026-06-01T11:00:00Z'),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('upserts when version matches', async () => {
    const db = makeDb(privateRow)
    const { upsertStopPrivateData } = await import('@/lib/api/tourStopPrivate')
    const result = await upsertStopPrivateData(
      db,
      'stop-1',
      'artist-1',
      { privateNotes: 'updated' },
      '2026-06-01T12:00:00Z',
    )
    expect(result.privateNotes).toBe('updated')
    expect(result.version).toBe(3)
  })

  it('loads private data for many stops with a single query', async () => {
    const rows = [
      { ...privateRow, stop_id: 'stop-1' },
      { ...privateRow, stop_id: 'stop-2', private_notes: 'second' },
    ]
    const chain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }
    const db = { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>
    const { getPrivateDataByStopIds } = await import('@/lib/api/tourStopPrivate')

    const byStop = await getPrivateDataByStopIds(db, ['stop-1', 'stop-2'], 'artist-1')

    expect(byStop.get('stop-1')?.privateNotes).toBe('secret')
    expect(byStop.get('stop-2')?.privateNotes).toBe('second')
    expect(chain.in).toHaveBeenCalledTimes(1)
  })
})