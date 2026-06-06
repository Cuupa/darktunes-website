import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  getMediaFolders,
  createMediaFolder,
  renameMediaFolder,
  moveMediaFolder,
  deleteMediaFolder,
} from './mediaFolders'

type DbClient = SupabaseClient<Database>
type FolderRow = Database['public']['Tables']['media_folders']['Row']
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
    is: vi.fn().mockReturnThis(),
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

const folderRow: FolderRow = {
  id: 'folder-1',
  name: 'Video Stills',
  parent_id: null,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('mediaFolders DAL', () => {
  it('getMediaFolders returns mapped folders', async () => {
    const db = makeMockDb([{ data: [folderRow], error: null }])
    const folders = await getMediaFolders(db)
    expect(folders).toHaveLength(1)
    expect(folders[0].name).toBe('Video Stills')
    expect(folders[0].artistId).toBeNull()
  })

  it('getMediaFolders throws on DB error', async () => {
    const db = makeMockDb([{ data: null, error: { message: 'DB error' } }])
    await expect(getMediaFolders(db)).rejects.toThrow('DB error')
  })

  it('createMediaFolder returns new folder', async () => {
    const db = makeMockDb([{ data: folderRow, error: null }])
    const folder = await createMediaFolder(db, 'Video Stills', null, 'user-1')
    expect(folder.name).toBe('Video Stills')
    expect(folder.createdBy).toBe('user-1')
  })

  it('renameMediaFolder returns updated folder', async () => {
    const renamed = { ...folderRow, name: 'Renamed' }
    const db = makeMockDb([{ data: renamed, error: null }])
    const folder = await renameMediaFolder(db, 'folder-1', 'Renamed')
    expect(folder.name).toBe('Renamed')
  })

  it('moveMediaFolder updates parentId', async () => {
    const moved = { ...folderRow, parent_id: 'folder-parent' }
    const db = makeMockDb([{ data: moved, error: null }])
    const folder = await moveMediaFolder(db, 'folder-1', 'folder-parent')
    expect(folder.parentId).toBe('folder-parent')
  })

  it('deleteMediaFolder resolves without error', async () => {
    const db = makeMockDb([{ data: null, error: null }])
    await expect(deleteMediaFolder(db, 'folder-1')).resolves.toBeUndefined()
  })
})
