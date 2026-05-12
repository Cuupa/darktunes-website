import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { ArtistAsset } from '@/types'

type DbClient = SupabaseClient<Database>
type ArtistAssetRow = Database['public']['Tables']['artist_assets']['Row']
export type ArtistAssetInsert = Database['public']['Tables']['artist_assets']['Insert']

function rowToArtistAsset(row: ArtistAssetRow): ArtistAsset {
  return {
    id: row.id,
    artistId: row.artist_id,
    filename: row.filename,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    r2Key: row.r2_key,
    publicUrl: row.public_url,
    label: row.label ?? undefined,
    createdAt: row.created_at,
  }
}

export async function getArtistAssets(db: DbClient, artistId: string): Promise<ArtistAsset[]> {
  const { data, error } = await db
    .from('artist_assets')
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToArtistAsset)
}

export async function createArtistAsset(db: DbClient, data: ArtistAssetInsert): Promise<ArtistAsset> {
  const { data: inserted, error } = await db.from('artist_assets').insert(data).select().single()
  if (error) throw new Error(error.message)
  if (!inserted) throw new Error('No data returned from createArtistAsset')
  return rowToArtistAsset(inserted)
}

export async function deleteArtistAsset(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('artist_assets').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
