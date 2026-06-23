import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getEpkVersionById, listEpkVersions } from './epkVersions'

function createMockDb(data: unknown = null, error: { message: string } | null = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    then: (
      resolve: (value: { data: unknown; error: typeof error }) => void,
    ) => resolve({ data, error }),
    catch: vi.fn().mockReturnThis(),
    finally: vi.fn().mockReturnThis(),
  }

  return {
    from: vi.fn(() => builder),
    builder,
  } as unknown as SupabaseClient<Database>
}

describe('epkVersions DAL', () => {
  it('lists versions for an artist', async () => {
    const rows = [
      {
        id: 'v1',
        artist_id: 'artist-1',
        document: { version: 2 },
        version_number: 2,
        label: 'Snapshot',
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    const db = createMockDb(rows)
    const versions = await listEpkVersions(db, 'artist-1')
    expect(versions).toHaveLength(1)
    expect(versions[0]?.versionNumber).toBe(2)
    expect(versions[0]?.label).toBe('Snapshot')
  })

  it('returns null when version is not found', async () => {
    const db = createMockDb(null)
    const version = await getEpkVersionById(db, 'artist-1', 'missing')
    expect(version).toBeNull()
  })
})