import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getAssets, createAssetRecord, deleteAssetRecord } from './assets'

type DbClient = SupabaseClient<Database>
type AssetRow = Database['public']['Tables']['assets']['Row']

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

const mockRow: AssetRow = {
  id: 'asset-uuid-1',
  filename: 'uploads/abc.jpg',
  original_filename: 'photo.jpg',
  mime_type: 'image/jpeg',
  size_bytes: 204800,
  r2_key: 'uploads/abc.jpg',
  public_url: 'https://cdn.darktunes.com/uploads/abc.jpg',
  uploaded_by: 'user-uuid-1',
  created_at: '2026-05-01T12:00:00Z',
}

describe('getAssets', () => {
  it('returns an empty array when no assets exist', async () => {
    const db = makeMockDb([])
    const result = await getAssets(db)
    expect(result).toEqual([])
  })

  it('maps rows to Asset domain objects', async () => {
    const db = makeMockDb([mockRow])
    const result = await getAssets(db)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('asset-uuid-1')
    expect(result[0].filename).toBe('uploads/abc.jpg')
    expect(result[0].originalFilename).toBe('photo.jpg')
    expect(result[0].mimeType).toBe('image/jpeg')
    expect(result[0].sizeBytes).toBe(204800)
    expect(result[0].r2Key).toBe('uploads/abc.jpg')
    expect(result[0].publicUrl).toBe('https://cdn.darktunes.com/uploads/abc.jpg')
    expect(result[0].uploadedBy).toBe('user-uuid-1')
    expect(result[0].createdAt).toBe('2026-05-01T12:00:00Z')
  })

  it('maps null uploaded_by to undefined', async () => {
    const db = makeMockDb([{ ...mockRow, uploaded_by: null }])
    const result = await getAssets(db)
    expect(result[0].uploadedBy).toBeUndefined()
  })

  it('throws when Supabase returns an error', async () => {
    const db = makeMockDb(null, { message: 'DB error' })
    await expect(getAssets(db)).rejects.toThrow('DB error')
  })
})

describe('createAssetRecord', () => {
  it('inserts and returns the created asset', async () => {
    const db = makeMockDb(mockRow)
    const result = await createAssetRecord(db, {
      filename: 'uploads/abc.jpg',
      original_filename: 'photo.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 204800,
      r2_key: 'uploads/abc.jpg',
      public_url: 'https://cdn.darktunes.com/uploads/abc.jpg',
      uploaded_by: 'user-uuid-1',
    })
    expect(result.id).toBe('asset-uuid-1')
    expect(result.originalFilename).toBe('photo.jpg')
  })

  it('throws when Supabase returns an error', async () => {
    const db = makeMockDb(null, { message: 'Insert failed' })
    await expect(
      createAssetRecord(db, {
        filename: 'f',
        original_filename: 'f',
        mime_type: 'image/jpeg',
        size_bytes: 1,
        r2_key: 'k',
        public_url: 'u',
      }),
    ).rejects.toThrow('Insert failed')
  })

  it('throws when no data is returned', async () => {
    const db = makeMockDb(null, null)
    await expect(
      createAssetRecord(db, {
        filename: 'f',
        original_filename: 'f',
        mime_type: 'image/jpeg',
        size_bytes: 1,
        r2_key: 'k',
        public_url: 'u',
      }),
    ).rejects.toThrow('No data returned from createAssetRecord')
  })
})

describe('deleteAssetRecord', () => {
  it('deletes without throwing on success', async () => {
    const db = makeMockDb(null)
    await expect(deleteAssetRecord(db, 'asset-uuid-1')).resolves.toBeUndefined()
  })

  it('throws when Supabase returns an error', async () => {
    const db = makeMockDb(null, { message: 'Delete failed' })
    await expect(deleteAssetRecord(db, 'asset-uuid-1')).rejects.toThrow('Delete failed')
  })
})
