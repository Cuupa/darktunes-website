import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { syncAll } from './syncAll'
import type { SyncAllDeps } from './syncAll'

type DbClient = SupabaseClient<Database>
type ArtistRow = Database['public']['Tables']['artists']['Row']
type QueryResult = { data: unknown; error: { message: string } | null }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createThenable(result: QueryResult) {
  const promise = Promise.resolve(result)
  return {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }
}

function makeBuilder(result: QueryResult) {
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => createThenable(result)),
    ...createThenable(result),
  }
}

function makeMockDb(factory: (table: string) => QueryResult): DbClient {
  return {
    from: vi.fn().mockImplementation((table: string) => makeBuilder(factory(table))),
  } as unknown as DbClient
}

const mockArtist: ArtistRow = {
  id: 'artist-1',
  name: 'Test Artist',
  slug: 'test-artist',
  image_url: null,
  logo_url: null,
  bio: null,
  bio_short: null,
  bio_medium: null,
  bio_long: null,
  genres: [],
  hometown: null,
  founding_year: null,
  itunes_id: null,
  spotify_id: null,
  discogs_id: null,
  songkick_id: null,
  bandsintown_id: null,
  facebook_url: null,
  twitter_url: null,
  instagram_url: null,
  youtube_url: null,
  bandcamp_url: null,
  soundcloud_url: null,
  website_url: null,
  apple_music_url: null,
  tiktok_url: null,
  spotify_popularity: null,
  spotify_followers: null,
  featured: false,
  active: true,
  sort_order: null,
  press_quote: null,
  press_contact: null,
  booking_contact: null,
  spotify_url: null,
  rider_stage_plot_url: null,
  rider_technical_url: null,
  rider_hospitality_url: null,
  onboarding_completed: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncAll', () => {
  it('returns error result when artists fetch fails', async () => {
    const db = makeMockDb(() => ({ data: null, error: { message: 'DB down' } }))
    const deps: SyncAllDeps = {
      db,
      fetch: vi.fn() as typeof fetch,
      uploadToR2: vi.fn().mockResolvedValue('https://cdn.example.com/image.jpg'),
    }
    const result = await syncAll(deps)
    expect(result.totalErrors).toBe(1)
    expect(result.results[0].errors[0]).toContain('DB down')
  })

  it('runs iTunes sync for artists with no external IDs', async () => {
    // DB returns one artist for 'artists', empty arrays for everything else
    const db = makeMockDb((table) => {
      if (table === 'artists') return { data: [mockArtist], error: null }
      return { data: [], error: null }
    })

    // Mock fetch to avoid real HTTP: iTunes search returns empty results
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ results: [] }),
    })

    const deps: SyncAllDeps = {
      db,
      fetch: fetchFn as typeof fetch,
      uploadToR2: vi.fn().mockResolvedValue('https://cdn.example.com/image.jpg'),
    }

    const result = await syncAll(deps)
    // iTunes result should be present
    const itunesResult = result.results.find((r) => r.api === 'itunes')
    expect(itunesResult).toBeDefined()
    expect(itunesResult?.artistsProcessed).toBe(1)
    // No hard errors for an artist without itunes_id
    expect(itunesResult?.errors).toHaveLength(0)
  })

  it('skips Spotify sync when no credentials provided', async () => {
    const db = makeMockDb((table) => {
      if (table === 'artists') return { data: [{ ...mockArtist, spotify_id: 'spot-1' }], error: null }
      return { data: [], error: null }
    })
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ results: [] }),
    })

    const deps: SyncAllDeps = {
      db,
      fetch: fetchFn as typeof fetch,
      uploadToR2: vi.fn(),
      // no spotify credentials → Spotify sync skipped
    }

    const result = await syncAll(deps)
    const spotifyResult = result.results.find((r) => r.api === 'spotify')
    expect(spotifyResult).toBeUndefined()
  })

  it('respects onlyApi filter', async () => {
    const db = makeMockDb((table) => {
      if (table === 'artists') return { data: [mockArtist], error: null }
      return { data: [], error: null }
    })
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ results: [] }),
    })

    const deps: SyncAllDeps = {
      db,
      fetch: fetchFn as typeof fetch,
      uploadToR2: vi.fn(),
      onlyApi: 'itunes',
    }

    const result = await syncAll(deps)
    expect(result.results.every((r) => r.api === 'itunes')).toBe(true)
  })
})
