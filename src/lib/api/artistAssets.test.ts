import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getArtistAssets, createArtistAsset, deleteArtistAsset } from './artistAssets'

type DbClient = SupabaseClient<Database>

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
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

const row = {
  id: 'asset-1',
  artist_id: 'artist-1',
  filename: 'file.pdf',
  original_filename: 'Press Kit.pdf',
  mime_type: 'application/pdf',
  size_bytes: 123,
  r2_key: 'artist-assets/artist-1/a.pdf',
  public_url: 'https://cdn.example/a.pdf',
  label: 'Press',
  created_at: '2026-05-01T00:00:00Z',
}

describe('artistAssets DAL', () => {
  it('gets artist assets', async () => {
    const db = makeMockDb([row])
    const items = await getArtistAssets(db, 'artist-1')
    expect(items[0].filename).toBe('file.pdf')
  })

  it('creates artist asset', async () => {
    const db = makeMockDb(row)
    const item = await createArtistAsset(db, {
      artist_id: 'artist-1',
      filename: 'file.pdf',
      original_filename: 'Press Kit.pdf',
      mime_type: 'application/pdf',
      size_bytes: 123,
      r2_key: 'artist-assets/artist-1/a.pdf',
      public_url: 'https://cdn.example/a.pdf',
    })
    expect(item.artistId).toBe('artist-1')
  })

  it('deletes artist asset', async () => {
    const db = makeMockDb(null)
    await expect(deleteArtistAsset(db, 'asset-1')).resolves.toBeUndefined()
  })
})
