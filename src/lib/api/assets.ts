import type { SupabaseClient } from '@supabase/supabase-js'
import type { Asset } from '@/types'
import type { Database } from '@/types/database'

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
    folderId: row.folder_id ?? undefined,
    artistId: row.artist_id ?? undefined,
    artistIds: [],
    releaseId: row.release_id ?? undefined,
    tags: row.tags ?? [],
    sha256Hash: row.sha256_hash ?? undefined,
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

export async function getAssetsByFolder(db: DbClient, folderId: string | null): Promise<Asset[]> {
  const query = db.from('assets').select('*').order('created_at', { ascending: false })
  if (folderId === null) {
    query.is('folder_id', null)
  } else {
    query.eq('folder_id', folderId)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToAsset)
}

export async function searchAssets(db: DbClient, query: string): Promise<Asset[]> {
  const { data, error } = await db
    .from('assets')
    .select('*')
    .ilike('original_filename', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToAsset)
}

export async function createAssetRecord(db: DbClient, assetData: AssetInsert): Promise<Asset> {
  const { data, error } = await db.from('assets').insert(assetData).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createAssetRecord')
  return rowToAsset(data)
}

export async function updateAsset(
  db: DbClient,
  id: string,
  updates: {
    folderId?: string | null
    artistId?: string | null
    artistIds?: string[]
    releaseId?: string | null
    tags?: string[]
    originalFilename?: string
  },
): Promise<Asset> {
  const dbUpdates: Database['public']['Tables']['assets']['Update'] = {}
  if ('folderId' in updates) dbUpdates.folder_id = updates.folderId ?? null
  if ('artistId' in updates) dbUpdates.artist_id = updates.artistId ?? null
  if ('releaseId' in updates) dbUpdates.release_id = updates.releaseId ?? null
  if ('tags' in updates) dbUpdates.tags = updates.tags ?? []
  if ('originalFilename' in updates) dbUpdates.original_filename = updates.originalFilename ?? ''

  const { data, error } = await db.from('assets').update(dbUpdates).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned')

  // If artistIds explicitly provided, replace the asset_artists junction rows
  if ('artistIds' in updates && updates.artistIds !== undefined) {
    await db.from('asset_artists').delete().eq('asset_id', id)
    if (updates.artistIds.length > 0) {
      const rows = updates.artistIds.map((artistId) => ({ asset_id: id, artist_id: artistId }))
      const { error: insertError } = await db.from('asset_artists').insert(rows)
      if (insertError) throw new Error(insertError.message)
    }
    // Auto-assign to collabs subfolder for each artist folder when 2+ artists
    if (updates.artistIds.length >= 2) {
      await ensureCollabsFolders(db, id, updates.artistIds)
    }
  }

  const asset = rowToAsset(data)
  // Fetch the current artistIds for the return value
  const { data: aaRows } = await db.from('asset_artists').select('artist_id').eq('asset_id', id)
  asset.artistIds = Array.isArray(aaRows) ? aaRows.map((r) => r.artist_id) : []
  return asset
}

async function ensureCollabsFolders(db: DbClient, assetId: string, artistIds: string[]): Promise<void> {
  for (const artistId of artistIds) {
    // Find the artist's root folder
    const { data: artistFolders } = await db
      .from('asset_folders')
      .select('id')
      .eq('artist_id', artistId)
      .is('parent_id', null)
    // The artist may have a non-root parent folder; find the folder linked directly to this artist
    const { data: anyArtistFolder } = await db
      .from('asset_folders')
      .select('id')
      .eq('artist_id', artistId)
      .limit(1)
    const parentId = artistFolders?.[0]?.id ?? anyArtistFolder?.[0]?.id ?? null
    if (!parentId) continue

    // Find or create "collabs" subfolder
    let collabsFolderId: string | null = null
    const { data: existing } = await db
      .from('asset_folders')
      .select('id')
      .eq('parent_id', parentId)
      .ilike('name', 'collabs')
      .maybeSingle()
    if (existing) {
      collabsFolderId = existing.id
    } else {
      const { data: created } = await db
        .from('asset_folders')
        .insert({ name: 'collabs', parent_id: parentId, artist_id: artistId })
        .select('id')
        .single()
      collabsFolderId = created?.id ?? null
    }

    // If the asset is not already in this artist's folder hierarchy, also set folder_id
    // (non-destructive: only set if asset currently has no folder or is in a different artist tree)
    if (collabsFolderId) {
      const { data: assetRow } = await db.from('assets').select('folder_id').eq('id', assetId).single()
      if (!assetRow?.folder_id) {
        await db.from('assets').update({ folder_id: collabsFolderId }).eq('id', assetId)
      }
    }
  }
}

export async function getAssetByHash(db: DbClient, hash: string): Promise<Asset | null> {
  const { data, error } = await db.from('assets').select('*').eq('sha256_hash', hash).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? rowToAsset(data) : null
}

export async function moveAsset(db: DbClient, id: string, newFolderId: string | null): Promise<Asset> {
  return updateAsset(db, id, { folderId: newFolderId })
}

export async function batchDeleteAssets(db: DbClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await db.from('assets').delete().in('id', ids)
  if (error) throw new Error(error.message)
}

export async function getAssetsByArtist(db: DbClient, artistId: string): Promise<Asset[]> {
  const { data, error } = await db
    .from('assets')
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToAsset)
}

export async function deleteAssetRecord(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('assets').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
