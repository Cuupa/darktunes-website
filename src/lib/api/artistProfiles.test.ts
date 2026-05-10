import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  getArtistProfileByArtistId,
  upsertArtistProfile,
  getArtistByUserId,
} from './artistProfiles'

type DbClient = SupabaseClient<Database>
type ArtistProfileRow = Database['public']['Tables']['artist_profiles']['Row']
type ArtistRow = Database['public']['Tables']['artists']['Row']

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

const mockProfileRow: ArtistProfileRow = {
  id: 'profile-uuid',
  artist_id: 'artist-uuid',
  bio: 'Dark electronic music from Berlin',
  bio_short: null,
  bio_medium: null,
  bio_long: null,
  photo_url: 'https://cdn.darktunes.com/photos/czarina.webp',
  genres: ['Darkpop', 'EBM'],
  website_url: 'https://czarina.music',
  instagram_url: null,
  youtube_url: null,
  bandcamp_url: null,
  press_quote: '"Outstanding!" — Darkroom Magazine',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockArtistRow: ArtistRow = {
  id: 'artist-uuid',
  name: 'C Z A R I N A',
  slug: 'czarina',
  bio: null,
  genres: [],
  image_url: null,
  spotify_url: null,
  instagram_url: null,
  youtube_url: null,
  website_url: null,
  featured: false,
  country: null,
  email: null,
  vat_number: null,
  is_eu_non_german: false,
  notes: null,
  spotify_id: null,
  discogs_id: null,
  songkick_id: null,
  last_synced_at: null,
  user_id: 'auth-user-uuid',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

describe('getArtistProfileByArtistId', () => {
  it('returns mapped ArtistProfile for a found row', async () => {
    const db = makeMockDb(mockProfileRow)
    const result = await getArtistProfileByArtistId(db, 'artist-uuid')
    expect(result).not.toBeNull()
    expect(result?.artistId).toBe('artist-uuid')
    expect(result?.bio).toBe('Dark electronic music from Berlin')
    expect(result?.genres).toEqual(['Darkpop', 'EBM'])
    expect(result?.pressQuote).toBe('"Outstanding!" — Darkroom Magazine')
  })

  it('returns null when profile not found (PGRST116)', async () => {
    const db = makeMockDb(null, { message: 'Not found', code: 'PGRST116' })
    const result = await getArtistProfileByArtistId(db, 'nonexistent')
    expect(result).toBeNull()
  })

  it('throws for non-PGRST116 errors', async () => {
    const db = makeMockDb(null, { message: 'Permission denied', code: 'PGRST301' })
    await expect(getArtistProfileByArtistId(db, 'some-id')).rejects.toThrow('Permission denied')
  })
})

describe('upsertArtistProfile', () => {
  it('returns the upserted ArtistProfile', async () => {
    const db = makeMockDb(mockProfileRow)
    const result = await upsertArtistProfile(db, {
      artist_id: 'artist-uuid',
      bio: 'Dark electronic music from Berlin',
    })
    expect(result.artistId).toBe('artist-uuid')
    expect(result.bio).toBe('Dark electronic music from Berlin')
  })

  it('throws when error is returned', async () => {
    const db = makeMockDb(null, { message: 'Conflict error', code: '23505' })
    await expect(upsertArtistProfile(db, { artist_id: 'artist-uuid', bio: 'Test' })).rejects.toThrow(
      'Conflict error',
    )
  })

  it('throws when no data is returned', async () => {
    const db = makeMockDb(null)
    await expect(upsertArtistProfile(db, { artist_id: 'artist-uuid' })).rejects.toThrow(
      'No data returned from upsertArtistProfile',
    )
  })
})

describe('getArtistByUserId', () => {
  it('returns mapped artist for matching user', async () => {
    const db = makeMockDb(mockArtistRow)
    const result = await getArtistByUserId(db, 'auth-user-uuid')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('artist-uuid')
    expect(result?.name).toBe('C Z A R I N A')
  })

  it('returns null when user has no linked artist (PGRST116)', async () => {
    const db = makeMockDb(null, { message: 'Not found', code: 'PGRST116' })
    const result = await getArtistByUserId(db, 'unlinked-user')
    expect(result).toBeNull()
  })

  it('throws for other DB errors', async () => {
    const db = makeMockDb(null, { message: 'DB failure', code: 'PGRST001' })
    await expect(getArtistByUserId(db, 'user-id')).rejects.toThrow('DB failure')
  })
})
