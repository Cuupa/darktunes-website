import type { SupabaseClient } from '@supabase/supabase-js'
import type { AssetFolder } from '@/types'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type FolderRow = Database['public']['Tables']['media_folders']['Row']

function rowToFolder(row: FolderRow): AssetFolder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id ?? null,
    artistId: null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getMediaFolders(db: DbClient): Promise<AssetFolder[]> {
  const { data, error } = await db
    .from('media_folders')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToFolder)
}

export async function createMediaFolder(
  db: DbClient,
  name: string,
  parentId: string | null,
  createdBy: string,
): Promise<AssetFolder> {
  const { data, error } = await db
    .from('media_folders')
    .insert({ name, parent_id: parentId, created_by: createdBy })
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned')
  return rowToFolder(data)
}

export async function renameMediaFolder(db: DbClient, id: string, name: string): Promise<AssetFolder> {
  const { data, error } = await db
    .from('media_folders')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned')
  return rowToFolder(data)
}

export async function moveMediaFolder(db: DbClient, id: string, newParentId: string | null): Promise<AssetFolder> {
  const { data, error } = await db
    .from('media_folders')
    .update({ parent_id: newParentId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned')
  return rowToFolder(data)
}

export async function deleteMediaFolder(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('media_folders').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
