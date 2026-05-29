import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  batchDeleteAssets,
  createAssetRecord,
  deleteAssetRecord,
  getAssetByHash,
  getAssets,
  getAssetsByArtist,
  getAssetsByFolder,
  moveAsset,
  searchAssets,
  updateAsset,
} from './assets'

type DbClient = SupabaseClient<Database>
type AssetRow = Database['public']['Tables']['assets']['Row']
type QueryResult = { data: unknown; error: { message: string } | null }

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
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(() => createThenable(result)),
    ...createThenable(result),
  }
}

function makeMockDb(results: QueryResult[]): DbClient {
  let index = 0
  return {
    from: vi.fn().mockImplementation(() => makeBuilder(results[Math.min(index++, results.length - 1)])),
  } as unknown as DbClient
}

const mockRow: AssetRow = {
  id: 'asset-uuid-1',
  filename: 'abc.jpg',
  original_filename: 'photo.jpg',
  mime_type: 'image/jpeg',
  size_bytes: 204800,
  r2_key: 'uploads/abc.jpg',
  public_url: 'https://cdn.darktunes.com/uploads/abc.jpg',
  uploaded_by: 'user-uuid-1',
  created_at: '2026-05-01T12:00:00Z',
  folder_id: 'folder-1',
  artist_id: 'artist-1',
  tags: ['cover', 'promo'],
  sha256_hash: 'abc123',
}

describe('assets DAL', () => {
  it('maps rows to Asset domain objects', async () => {
    const db = makeMockDb([{ data: [mockRow], error: null }])
    const result = await getAssets(db)
    expect(result[0]).toMatchObject({
      id: 'asset-uuid-1',
      originalFilename: 'photo.jpg',
      folderId: 'folder-1',
      artistId: 'artist-1',
      tags: ['cover', 'promo'],
      sha256Hash: 'abc123',
    })
  })

  it('filters assets by folder', async () => {
    const db = makeMockDb([{ data: [mockRow], error: null }])
    const result = await getAssetsByFolder(db, 'folder-1')
    expect(result).toHaveLength(1)
  })

  it('searches assets by original filename', async () => {
    const db = makeMockDb([{ data: [mockRow], error: null }])
    const result = await searchAssets(db, 'photo')
    expect(result[0].originalFilename).toBe('photo.jpg')
  })

  it('creates an asset record', async () => {
    const db = makeMockDb([{ data: mockRow, error: null }])
    const result = await createAssetRecord(db, {
      filename: 'abc.jpg',
      original_filename: 'photo.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 204800,
      r2_key: 'uploads/abc.jpg',
      public_url: 'https://cdn.darktunes.com/uploads/abc.jpg',
      uploaded_by: 'user-uuid-1',
      folder_id: 'folder-1',
      artist_id: 'artist-1',
      tags: ['cover', 'promo'],
      sha256_hash: 'abc123',
    })
    expect(result.tags).toEqual(['cover', 'promo'])
  })

  it('updates an asset', async () => {
    const db = makeMockDb([{ data: { ...mockRow, original_filename: 'new-name.jpg' }, error: null }])
    const result = await updateAsset(db, 'asset-uuid-1', { originalFilename: 'new-name.jpg' })
    expect(result.originalFilename).toBe('new-name.jpg')
  })

  it('moves an asset to another folder', async () => {
    const db = makeMockDb([{ data: { ...mockRow, folder_id: 'folder-2' }, error: null }])
    const result = await moveAsset(db, 'asset-uuid-1', 'folder-2')
    expect(result.folderId).toBe('folder-2')
  })

  it('finds an asset by hash', async () => {
    const db = makeMockDb([{ data: mockRow, error: null }])
    const result = await getAssetByHash(db, 'abc123')
    expect(result?.sha256Hash).toBe('abc123')
  })

  it('gets assets by artist', async () => {
    const db = makeMockDb([{ data: [mockRow], error: null }])
    const result = await getAssetsByArtist(db, 'artist-1')
    expect(result[0].artistId).toBe('artist-1')
  })

  it('batch deletes assets', async () => {
    const db = makeMockDb([{ data: null, error: null }])
    await expect(batchDeleteAssets(db, ['asset-uuid-1'])).resolves.toBeUndefined()
  })

  it('deletes an asset record', async () => {
    const db = makeMockDb([{ data: null, error: null }])
    await expect(deleteAssetRecord(db, 'asset-uuid-1')).resolves.toBeUndefined()
  })

  it('throws when Supabase returns an error', async () => {
    const db = makeMockDb([{ data: null, error: { message: 'DB error' } }])
    await expect(getAssets(db)).rejects.toThrow('DB error')
  })
})
