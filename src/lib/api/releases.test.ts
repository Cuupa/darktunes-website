import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  getReleases,
  createRelease,
  deleteRelease,
  upsertReleaseByItunesId,
  getReleaseById,
} from './releases'

type DbClient = SupabaseClient<Database>
type ReleaseRow = Database['public']['Tables']['releases']['Row']

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeMockDb(data: unknown = null, error: unknown = null): DbClient {
  return { from: vi.fn().mockReturnValue(makeBuilder(data, error)) } as unknown as DbClient
}

const mockReleaseRow: ReleaseRow = {
  id: 'rel-001',
  title: 'Polymorph',
  artist_id: 'art-001',
  artist_name: 'C Z A R I N A',
  release_date: '2024-03-15',
  cover_art: 'https://example.com/cover.jpg',
  type: 'album',
  spotify_url: 'https://open.spotify.com/album/polymorph',
  apple_music_url: null,
  youtube_url: null,
  featured: true,
  itunes_id: '123456789',
  spotify_id: null,
  discogs_id: null,
  isrc: null,
  barcode: null,
  catalog_number: null,
  preview_url: null,
  smart_url: null,
  popularity: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

describe('getReleases', () => {
  it('returns an empty array when there are no releases', async () => {
    const db = makeMockDb([])
    const result = await getReleases(db)
    expect(result).toEqual([])
  })

  it('maps rows to Release domain objects', async () => {
    const db = makeMockDb([mockReleaseRow])
    const result = await getReleases(db)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Polymorph')
    expect(result[0].artistName).toBe('C Z A R I N A')
    expect(result[0].type).toBe('album')
    expect(result[0].featured).toBe(true)
  })

  it('throws on error', async () => {
    const db = makeMockDb(null, { message: 'Connection error', code: 'PGRST001' })
    await expect(getReleases(db)).rejects.toThrow('Connection error')
  })
})

describe('getReleaseById', () => {
  it('returns null when not found (PGRST116)', async () => {
    const db = makeMockDb(null, { message: 'Not found', code: 'PGRST116' })
    const result = await getReleaseById(db, 'nonexistent')
    expect(result).toBeNull()
  })

  it('returns mapped Release for found row', async () => {
    const db = makeMockDb(mockReleaseRow)
    const result = await getReleaseById(db, mockReleaseRow.id)
    expect(result?.title).toBe('Polymorph')
    expect(result?.itunesId).toBe('123456789')
  })
})

describe('createRelease', () => {
  it('returns the created Release', async () => {
    const db = makeMockDb(mockReleaseRow)
    const result = await createRelease(db, {
      title: 'Polymorph',
      artist_name: 'C Z A R I N A',
      release_date: '2024-03-15',
      type: 'album',
    })
    expect(result.id).toBe('rel-001')
    expect(result.title).toBe('Polymorph')
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'Insert failed', code: 'PGRST001' })
    await expect(
      createRelease(db, {
        title: 'Test',
        artist_name: 'Artist',
        release_date: '2024-01-01',
        type: 'single',
      }),
    ).rejects.toThrow('Insert failed')
  })

  it('throws when no data returned', async () => {
    const db = makeMockDb(null)
    await expect(
      createRelease(db, {
        title: 'Test',
        artist_name: 'Artist',
        release_date: '2024-01-01',
        type: 'single',
      }),
    ).rejects.toThrow('No data returned from createRelease')
  })
})

describe('deleteRelease', () => {
  it('resolves without error on success', async () => {
    const db = makeMockDb(null, null)
    await expect(deleteRelease(db, 'rel-001')).resolves.toBeUndefined()
  })

  it('throws when deletion fails', async () => {
    const db = makeMockDb(null, { message: 'Delete denied', code: 'PGRST301' })
    await expect(deleteRelease(db, 'rel-001')).rejects.toThrow('Delete denied')
  })
})

describe('upsertReleaseByItunesId', () => {
  it('returns the upserted Release', async () => {
    const db = makeMockDb(mockReleaseRow)
    const result = await upsertReleaseByItunesId(db, {
      title: 'Polymorph',
      artist_name: 'C Z A R I N A',
      release_date: '2024-03-15',
      type: 'album',
      itunes_id: '123456789',
    })
    expect(result.itunesId).toBe('123456789')
  })

  it('throws on conflict error', async () => {
    const db = makeMockDb(null, { message: 'Upsert error', code: 'PGRST001' })
    await expect(
      upsertReleaseByItunesId(db, {
        title: 'Test',
        artist_name: 'Artist',
        release_date: '2024-01-01',
        type: 'single',
        itunes_id: '999',
      }),
    ).rejects.toThrow('Upsert error')
  })
})
