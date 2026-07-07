import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { syncArtist } from './syncArtist'

type DbClient = SupabaseClient<Database>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ArtistRow = Pick<Database['public']['Tables']['artists']['Row'], 'id' | 'name'>

function makeArtistBuilder(
  data: ArtistRow | null = null,
  error: { message: string; code?: string } | null = null,
) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeReleasesTableBuilder(
  data: unknown = DEFAULT_RELEASE_ROW,
  listData: unknown[] = [],
) {
  const listResult = { data: listData, error: null }
  const listPromise = Promise.resolve(listResult)
  const singleResult = { data, error: null }
  const singlePromise = Promise.resolve(singleResult)
  const maybeSingleResult = { data: null, error: null }
  const maybeSinglePromise = Promise.resolve(maybeSingleResult)
  const updateResult = { data: null, error: null }
  const updatePromise = Promise.resolve(updateResult)

  const builder = {
    upsert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: listPromise.then.bind(listPromise),
    catch: listPromise.catch.bind(listPromise),
    finally: listPromise.finally.bind(listPromise),
  }

  builder.maybeSingle = vi.fn().mockImplementation(() => ({
    then: maybeSinglePromise.then.bind(maybeSinglePromise),
    catch: maybeSinglePromise.catch.bind(maybeSinglePromise),
    finally: maybeSinglePromise.finally.bind(maybeSinglePromise),
  }))

  builder.single = vi.fn().mockImplementation(() => ({
    then: singlePromise.then.bind(singlePromise),
    catch: singlePromise.catch.bind(singlePromise),
    finally: singlePromise.finally.bind(singlePromise),
  }))

  builder.update = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockImplementation(() => ({
          then: singlePromise.then.bind(singlePromise),
          catch: singlePromise.catch.bind(singlePromise),
          finally: singlePromise.finally.bind(singlePromise),
        })),
      }),
      then: updatePromise.then.bind(updatePromise),
      catch: updatePromise.catch.bind(updatePromise),
      finally: updatePromise.finally.bind(updatePromise),
    }),
  })

  return builder
}

function makeGenericBuilder(data: unknown = null, error: unknown = null) {
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
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

const ARTIST_ID = 'artist-uuid-1'
const ARTIST_ROW: ArtistRow = { id: ARTIST_ID, name: 'Test Artist' }

const DEFAULT_RELEASE_ROW = {
  id: 'r1',
  title: 'Test Album',
  release_date: '2024-01-15',
  spotify_id: null,
  itunes_id: '123',
  discogs_id: null,
  isrc: null,
  barcode: null,
  artist_id: ARTIST_ID,
  cover_art: null,
  type: 'album',
  apple_music_url: 'https://music.apple.com/album/123',
  featured: false,
}

const ITUNES_RELEASE = {
  wrapperType: 'collection',
  collectionId: 123,
  collectionName: 'Test Album',
  artistId: 999,
  artistName: 'Test Artist',
  artworkUrl100: 'https://itunes.apple.com/art100.jpg',
  artworkUrl600: 'https://itunes.apple.com/art600.jpg',
  releaseDate: '2024-01-15T00:00:00Z',
  collectionType: 'Album',
  trackCount: 10,
  primaryGenreName: 'Electronic',
  collectionViewUrl: 'https://music.apple.com/album/123',
}

const ITUNES_RESPONSE = {
  resultCount: 1,
  results: [ITUNES_RELEASE],
}

const ITUNES_ARTIST_SEARCH_RESPONSE = {
  resultCount: 1,
  results: [{ artistId: ITUNES_RELEASE.artistId, artistName: ITUNES_RELEASE.artistName }],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncArtist', () => {
  it('returns error in result when artist is not found', async () => {
    const fromFn = vi.fn().mockReturnValue(
      makeArtistBuilder(null, { message: 'Not found', code: 'PGRST116' }),
    )
    const db = { from: fromFn } as unknown as DbClient

    const result = await syncArtist(ARTIST_ID, {
      db,
      fetch: vi.fn(),
      uploadToR2: vi.fn(),
    })

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Not found')
    expect(result.releasesUpserted).toBe(0)
  })

  it('upserts before uploading cover art to R2', async () => {
    const callOrder: string[] = []
    const mockFetch = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('/search') ? ITUNES_ARTIST_SEARCH_RESPONSE : ITUNES_RESPONSE),
    } as Response))

    const mockUploadToR2 = vi.fn().mockImplementation(async () => {
      callOrder.push('upload')
      return 'https://cdn.darktunes.com/cover-art/123.jpg'
    })

    const releaseUpsert = vi.fn().mockImplementation(() => {
      callOrder.push('upsert')
      return makeReleasesTableBuilder()
    })

    const fromFn = vi.fn((table: string) => {
      if (table === 'artists') return makeArtistBuilder(ARTIST_ROW)
      if (table === 'releases') {
        const builder = makeReleasesTableBuilder()
        builder.upsert = releaseUpsert
        return builder
      }
      return makeGenericBuilder()
    })
    const db = { from: fromFn } as unknown as DbClient

    await syncArtist(ARTIST_ID, {
      db,
      fetch: mockFetch,
      uploadToR2: mockUploadToR2,
    })

    expect(callOrder).toEqual(['upsert', 'upload'])
  })

  it('upserts releases and returns success result', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('/search') ? ITUNES_ARTIST_SEARCH_RESPONSE : ITUNES_RESPONSE),
    } as Response))

    const mockUploadToR2 = vi.fn().mockResolvedValue('https://cdn.darktunes.com/cover-art/123.jpg')

    // from() is called for: artists.select, artists.update, releases.upsert, sync_logs.insert
    const fromFn = vi.fn((table: string) => {
      if (table === 'artists') return makeArtistBuilder(ARTIST_ROW)
      if (table === 'releases') return makeReleasesTableBuilder()
      return makeGenericBuilder()
    })
    const db = { from: fromFn } as unknown as DbClient

    const result = await syncArtist(ARTIST_ID, {
      db,
      fetch: mockFetch,
      uploadToR2: mockUploadToR2,
    })

    expect(result.artistId).toBe(ARTIST_ID)
    expect(result.releasesUpserted).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(mockUploadToR2).toHaveBeenCalledWith(
      ITUNES_RELEASE.artworkUrl600,
      'cover-art',
    )
  })

  it('stores iTunes titles without streaming suffixes', async () => {
    const itunesWithSuffix = {
      ...ITUNES_RELEASE,
      collectionName: 'Test Album - Single',
      trackCount: 1,
    }
    const itunesResponseWithSuffix = {
      resultCount: 1,
      results: [itunesWithSuffix],
    }

    const mockFetch = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('/search') ? ITUNES_ARTIST_SEARCH_RESPONSE : itunesResponseWithSuffix,
    } as Response))

    const releaseUpsert = vi.fn().mockImplementation(() => makeReleasesTableBuilder())
    const fromFn = vi.fn((table: string) => {
      if (table === 'artists') return makeArtistBuilder(ARTIST_ROW)
      if (table === 'releases') {
        const builder = makeReleasesTableBuilder()
        builder.upsert = releaseUpsert
        return builder
      }
      return makeGenericBuilder()
    })
    const db = { from: fromFn } as unknown as DbClient

    await syncArtist(ARTIST_ID, {
      db,
      fetch: mockFetch,
      uploadToR2: vi.fn().mockResolvedValue('https://cdn.darktunes.com/cover-art/123.jpg'),
    })

    expect(releaseUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test Album' }),
      expect.any(Object),
    )
  })

  it('gracefully handles R2 upload failure and falls back to original URL', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('/search') ? ITUNES_ARTIST_SEARCH_RESPONSE : ITUNES_RESPONSE),
    } as Response))

    const mockUploadToR2 = vi.fn().mockRejectedValue(new Error('R2 connection refused'))

    const fromFn = vi.fn((table: string) => {
      if (table === 'artists') {
        return makeArtistBuilder(ARTIST_ROW)
      }
      if (table === 'releases') return makeReleasesTableBuilder()
      return makeGenericBuilder()
    })
    const db = { from: fromFn } as unknown as DbClient

    const result = await syncArtist(ARTIST_ID, {
      db,
      fetch: mockFetch,
      uploadToR2: mockUploadToR2,
    })

    // Upload failure is captured as an error but sync continues
    expect(result.errors.some((e) => e.includes('Cover art upload failed'))).toBe(true)
    // Release was still upserted (with fallback URL)
    expect(result.releasesUpserted).toBe(1)
  })

  it('captures iTunes fetch failure in errors and returns partial result', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'))

    const fromFn = vi.fn((table: string) => {
      if (table === 'artists') return makeArtistBuilder(ARTIST_ROW)
      return makeGenericBuilder()
    })
    const db = { from: fromFn } as unknown as DbClient

    const result = await syncArtist(ARTIST_ID, {
      db,
      fetch: mockFetch,
      uploadToR2: vi.fn(),
    })

    expect(result.errors.some((e) => e.includes('iTunes fetch failed'))).toBe(true)
    expect(result.releasesUpserted).toBe(0)
  })

  it('writes sync_logs entry with status=success when no errors', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('/search') ? ITUNES_ARTIST_SEARCH_RESPONSE : ITUNES_RESPONSE),
    } as Response))
    const mockUploadToR2 = vi.fn().mockResolvedValue('https://cdn.darktunes.com/art.jpg')

    const syncLogInsert = vi.fn().mockReturnThis()
    const fromFn = vi.fn((table: string) => {
      if (table === 'artists') return makeArtistBuilder(ARTIST_ROW)
      if (table === 'releases') return makeReleasesTableBuilder()
      if (table === 'sync_logs') {
        const b = makeGenericBuilder()
        b.insert = syncLogInsert
        return b
      }
      return makeGenericBuilder()
    })
    const db = { from: fromFn } as unknown as DbClient

    const result = await syncArtist(ARTIST_ID, {
      db,
      fetch: mockFetch,
      uploadToR2: mockUploadToR2,
    })

    expect(result.errors).toHaveLength(0)
    expect(syncLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', releases_synced: 1 }),
    )
  })

  it('writes sync_logs entry with status=error when iTunes fails and no releases upserted', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Unreachable'))

    const syncLogInsert = vi.fn().mockReturnThis()
    const fromFn = vi.fn((table: string) => {
      if (table === 'artists') return makeArtistBuilder(ARTIST_ROW)
      if (table === 'sync_logs') {
        const b = makeGenericBuilder()
        b.insert = syncLogInsert
        return b
      }
      return makeGenericBuilder()
    })
    const db = { from: fromFn } as unknown as DbClient

    await syncArtist(ARTIST_ID, {
      db,
      fetch: mockFetch,
      uploadToR2: vi.fn(),
    })

    expect(syncLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', releases_synced: 0 }),
    )
  })
})
