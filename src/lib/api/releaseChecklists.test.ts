import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  getOrCreateReleaseChecklist,
  toggleChecklistItem,
  DEFAULT_RELEASE_TASKS,
} from './releaseChecklists'

type DbClient = SupabaseClient<Database>
type ChecklistRow = Database['public']['Tables']['release_checklists']['Row']

const ARTIST_ID = 'artist-uuid-001'
const RELEASE_ID = 'release-uuid-001'

const mockRow: ChecklistRow = {
  id: 'checklist-001',
  artist_id: ARTIST_ID,
  release_id: RELEASE_ID,
  task: 'Export final 24-bit WAV master',
  is_completed: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// Builder that supports the full Supabase chain:
// .from().select().eq().eq().order() — for getOrCreate fetch path
// .from().insert().select()         — for getOrCreate seed path
// .from().update().eq().select().single() — for toggle path
function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeMockDb(data: unknown = null, error: unknown = null): DbClient {
  return { from: vi.fn().mockReturnValue(makeBuilder(data, error)) } as unknown as DbClient
}

// For the getOrCreate test we need to simulate two sequential from() calls
// (one returning empty, one returning the seeded rows).
function makeMockDbSequence(responses: Array<{ data: unknown; error: unknown }>): DbClient {
  let callIndex = 0
  return {
    from: vi.fn().mockImplementation(() => {
      const resp = responses[callIndex] ?? responses[responses.length - 1]
      callIndex++
      return makeBuilder(resp.data, resp.error)
    }),
  } as unknown as DbClient
}

// ─── getOrCreateReleaseChecklist ────────────────────────────────────────────

describe('getOrCreateReleaseChecklist', () => {
  it('returns existing checklist rows when they are present', async () => {
    const db = makeMockDb([mockRow])
    const result = await getOrCreateReleaseChecklist(db, ARTIST_ID, RELEASE_ID)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('checklist-001')
    expect(result[0].artistId).toBe(ARTIST_ID)
    expect(result[0].isCompleted).toBe(false)
  })

  it('seeds DEFAULT_RELEASE_TASKS when no rows exist and returns the created rows', async () => {
    // First call (fetch) returns empty, second call (insert) returns seeded rows
    const seededRows: ChecklistRow[] = DEFAULT_RELEASE_TASKS.map((task, i) => ({
      id: `seeded-${i}`,
      artist_id: ARTIST_ID,
      release_id: RELEASE_ID,
      task,
      is_completed: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }))

    const db = makeMockDbSequence([
      { data: [], error: null },            // fetch → empty
      { data: seededRows, error: null },    // insert → seeded rows
    ])

    const result = await getOrCreateReleaseChecklist(db, ARTIST_ID, RELEASE_ID)
    expect(result).toHaveLength(DEFAULT_RELEASE_TASKS.length)
    expect(result[0].task).toBe(DEFAULT_RELEASE_TASKS[0])
    expect(result[0].isCompleted).toBe(false)
  })

  it('throws when the fetch query fails', async () => {
    const db = makeMockDb(null, { message: 'Fetch failed', code: 'PGRST001' })
    await expect(getOrCreateReleaseChecklist(db, ARTIST_ID, RELEASE_ID)).rejects.toThrow(
      'Fetch failed',
    )
  })

  it('throws when the insert query fails', async () => {
    const db = makeMockDbSequence([
      { data: [], error: null },
      { data: null, error: { message: 'Insert failed', code: 'PGRST001' } },
    ])
    await expect(getOrCreateReleaseChecklist(db, ARTIST_ID, RELEASE_ID)).rejects.toThrow(
      'Insert failed',
    )
  })
})

// ─── toggleChecklistItem ─────────────────────────────────────────────────────

describe('toggleChecklistItem', () => {
  it('returns the updated checklist item on success', async () => {
    const updatedRow: ChecklistRow = { ...mockRow, is_completed: true }
    const db = makeMockDb(updatedRow)
    const result = await toggleChecklistItem(db, mockRow.id, true)
    expect(result.id).toBe('checklist-001')
    expect(result.isCompleted).toBe(true)
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'Update denied', code: 'PGRST301' })
    await expect(toggleChecklistItem(db, 'bad-id', true)).rejects.toThrow('Update denied')
  })

  it('throws when no data is returned', async () => {
    const db = makeMockDb(null, null)
    await expect(toggleChecklistItem(db, 'some-id', false)).rejects.toThrow(
      'No data returned from toggleChecklistItem',
    )
  })
})
