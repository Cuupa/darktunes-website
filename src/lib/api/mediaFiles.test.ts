import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  getMediaFilesByFolder,
  searchMediaFiles,
  createMediaFileRecord,
  updateMediaFile,
  getMediaFileByHash,
  deleteMediaFileRecord,
  batchDeleteMediaFiles,
} from './mediaFiles'
import type { MediaFileInsert } from './mediaFiles'

type DbClient = SupabaseClient<Database>
type FileRow = Database['public']['Tables']['media_files']['Row']
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
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => createThenable(result)),
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

const fileRow: FileRow = {
  id: 'file-1',
  filename: 'photo.jpg',
  original_filename: 'photo.jpg',
  mime_type: 'image/jpeg',
  size_bytes: 12345,
  r2_key: 'media/photo.jpg',
  public_url: 'https://cdn.example.com/photo.jpg',
  uploaded_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  folder_id: 'folder-1',
  artist_id: 'artist-1',
  tags: ['press'],
  sha256_hash: 'abc123',
}

describe('mediaFiles DAL', () => {
  it('getMediaFilesByFolder returns mapped files', async () => {
    const db = makeMockDb([{ data: [fileRow], error: null }])
    const files = await getMediaFilesByFolder(db, 'folder-1')
    expect(files).toHaveLength(1)
    expect(files[0].filename).toBe('photo.jpg')
    expect(files[0].folderId).toBe('folder-1')
    expect(files[0].sha256Hash).toBe('abc123')
  })

  it('getMediaFilesByFolder throws on DB error', async () => {
    const db = makeMockDb([{ data: null, error: { message: 'fail' } }])
    await expect(getMediaFilesByFolder(db, null)).rejects.toThrow('fail')
  })

  it('searchMediaFiles returns matched files', async () => {
    const db = makeMockDb([{ data: [fileRow], error: null }])
    const results = await searchMediaFiles(db, 'photo')
    expect(results[0].originalFilename).toBe('photo.jpg')
  })

  it('createMediaFileRecord returns mapped asset', async () => {
    const db = makeMockDb([{ data: fileRow, error: null }])
    const insert: MediaFileInsert = {
      filename: 'photo.jpg',
      original_filename: 'photo.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 12345,
      r2_key: 'media/photo.jpg',
      public_url: 'https://cdn.example.com/photo.jpg',
    }
    const asset = await createMediaFileRecord(db, insert)
    expect(asset.id).toBe('file-1')
    expect(asset.mimeType).toBe('image/jpeg')
  })

  it('updateMediaFile returns updated asset', async () => {
    const updated = { ...fileRow, tags: ['hero'] }
    const db = makeMockDb([{ data: updated, error: null }])
    const asset = await updateMediaFile(db, 'file-1', { tags: ['hero'] })
    expect(asset.tags).toEqual(['hero'])
  })

  it('getMediaFileByHash returns asset when found', async () => {
    const db = makeMockDb([{ data: fileRow, error: null }])
    const asset = await getMediaFileByHash(db, 'abc123')
    expect(asset?.sha256Hash).toBe('abc123')
  })

  it('getMediaFileByHash returns null when not found', async () => {
    const db = makeMockDb([{ data: null, error: null }])
    const asset = await getMediaFileByHash(db, 'notfound')
    expect(asset).toBeNull()
  })

  it('deleteMediaFileRecord resolves without error', async () => {
    const db = makeMockDb([{ data: null, error: null }])
    await expect(deleteMediaFileRecord(db, 'file-1')).resolves.toBeUndefined()
  })

  it('batchDeleteMediaFiles resolves for empty array immediately', async () => {
    const db = makeMockDb([])
    await expect(batchDeleteMediaFiles(db, [])).resolves.toBeUndefined()
    expect((db.from as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })

  it('batchDeleteMediaFiles calls delete for non-empty array', async () => {
    const db = makeMockDb([{ data: null, error: null }])
    await expect(batchDeleteMediaFiles(db, ['file-1', 'file-2'])).resolves.toBeUndefined()
  })
})
