import type { SupabaseClient } from '@supabase/supabase-js'
import type { Asset } from '@/types'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type MediaFileRow = Database['public']['Tables']['media_files']['Row']
export type MediaFileInsert = Database['public']['Tables']['media_files']['Insert']

function rowToMediaFile(row: MediaFileRow): Asset {
  return {
    id: row.id,
    filename: row.filename,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    r2Key: row.r2_key,
    publicUrl: row.public_url,
    uploadedBy: row.uploaded_by ?? undefined,
    createdAt: row.created_at,
    folderId: row.folder_id ?? undefined,
    artistId: row.artist_id ?? undefined,
    artistIds: row.artist_id ? [row.artist_id] : [],
    releaseId: undefined,
    tags: row.tags ?? [],
    sha256Hash: row.sha256_hash ?? undefined,
  }
}

export async function getMediaFilesByFolder(db: DbClient, folderId: string | null): Promise<Asset[]> {
  const query = db.from('media_files').select('*').order('created_at', { ascending: false })
  if (folderId === null) {
    query.is('folder_id', null)
  } else {
    query.eq('folder_id', folderId)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToMediaFile)
}

export async function searchMediaFiles(db: DbClient, query: string): Promise<Asset[]> {
  const { data, error } = await db
    .from('media_files')
    .select('*')
    .ilike('original_filename', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToMediaFile)
}

export async function createMediaFileRecord(db: DbClient, fileData: MediaFileInsert): Promise<Asset> {
  const { data, error } = await db.from('media_files').insert(fileData).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createMediaFileRecord')
  return rowToMediaFile(data)
}

export async function updateMediaFile(
  db: DbClient,
  id: string,
  updates: {
    folderId?: string | null
    artistId?: string | null
    tags?: string[]
    originalFilename?: string
  },
): Promise<Asset> {
  const dbUpdates: Database['public']['Tables']['media_files']['Update'] = {}
  if ('folderId' in updates) dbUpdates.folder_id = updates.folderId ?? null
  if ('artistId' in updates) dbUpdates.artist_id = updates.artistId ?? null
  if ('tags' in updates) dbUpdates.tags = updates.tags ?? []
  if ('originalFilename' in updates) dbUpdates.original_filename = updates.originalFilename ?? ''

  const { data, error } = await db.from('media_files').update(dbUpdates).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned')
  return rowToMediaFile(data)
}

export async function getMediaFileByHash(db: DbClient, hash: string): Promise<Asset | null> {
  const { data, error } = await db.from('media_files').select('*').eq('sha256_hash', hash).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? rowToMediaFile(data) : null
}

export async function deleteMediaFileRecord(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('media_files').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function batchDeleteMediaFiles(db: DbClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await db.from('media_files').delete().in('id', ids)
  if (error) throw new Error(error.message)
}
