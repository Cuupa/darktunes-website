import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Asset } from '@/types'

type DbClient = SupabaseClient<Database>
type AssetRow = Database['public']['Tables']['assets']['Row']
export type AssetInsert = Database['public']['Tables']['assets']['Insert']

function rowToAsset(row: AssetRow): Asset {
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
  }
}

export async function getAssets(db: DbClient): Promise<Asset[]> {
  const { data, error } = await db
    .from('assets')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToAsset)
}

export async function createAssetRecord(db: DbClient, assetData: AssetInsert): Promise<Asset> {
  const { data, error } = await db.from('assets').insert(assetData).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createAssetRecord')
  return rowToAsset(data)
}

export async function deleteAssetRecord(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('assets').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
