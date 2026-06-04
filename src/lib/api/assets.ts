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

  // When only junction-table fields (artistIds) are updated, dbUpdates is
  // empty. Calling .update({}) throws "Nothing to update" in Supabase.
  // Instead, fetch the current row so downstream code still has a `data` ref.
  let data: AssetRow
  if (Object.keys(dbUpdates).length === 0) {
    const { data: fetched, error: fetchErr } = await db.from('assets').select('*').eq('id', id).single()
    if (fetchErr) throw new Error(fetchErr.message)
    if (!fetched) throw new Error('Asset not found')
    data = fetched
  } else {
    const { data: updated, error } = await db.from('assets').update(dbUpdates).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    if (!updated) throw new Error('No data returned')
    data = updated
  }

  // If artistIds explicitly provided, replace the asset_artists junction rows
  if ('artistIds' in updates && updates.artistIds !== undefined) {
    await db.from('asset_artists').delete().eq('asset_id', id)
    if (updates.artistIds.length > 0) {
      const rows = updates.artistIds.map((artistId) => ({ asset_id: id, artist_id: artistId }))
      const { error: insertError } = await db.from('asset_artists').insert(rows)
      if (insertError) throw new Error(insertError.message)
    }
    // Keep the direct artist_id column in sync with the first assigned artist
    const primaryArtistId = updates.artistIds[0] ?? null
    const { error: syncErr } = await db
      .from('assets')
      .update({ artist_id: primaryArtistId })
      .eq('id', id)
    if (syncErr) throw new Error(syncErr.message)
    // Auto-assign to artist folder (single) or collabs subfolder (multi)
    await ensureCollabsFolders(db, id, updates.artistIds)
  }

  const asset = rowToAsset(data)
  // Fetch the current artistIds for the return value
  const { data: aaRows } = await db.from('asset_artists').select('artist_id').eq('asset_id', id)
  asset.artistIds = Array.isArray(aaRows) ? aaRows.map((r) => r.artist_id) : []
  return asset
}

async function ensureCollabsFolders(db: DbClient, assetId: string, artistIds: string[]): Promise<void> {
  if (artistIds.length === 0) return

  // Batch-fetch root folders for all artists in one query
  const { data: rootFolders } = await db
    .from('asset_folders')
    .select('id, artist_id')
    .in('artist_id', artistIds)
    .is('parent_id', null)

  // Filter out null artist_id values BEFORE creating Set
  const validRootFolders = (rootFolders ?? []).filter(
    (f): f is { id: string; artist_id: string } => f.artist_id !== null
  )

  // For artists without a root folder, fall back to any folder linked to that artist
  const artistsWithRoot = new Set(validRootFolders.map((f) => f.artist_id))
  const artistsWithoutRoot = artistIds.filter((id) => !artistsWithRoot.has(id))

  let fallbackFolders: { id: string; artist_id: string }[] = []
  if (artistsWithoutRoot.length > 0) {
    // Fetch the first folder for each artist that lacks a root folder
    const { data: fb } = await db
      .from('asset_folders')
      .select('id, artist_id')
      .in('artist_id', artistsWithoutRoot)
    
    // Filter out null artist_id values
    const validFallbackFolders = (fb ?? []).filter(
      (f): f is { id: string; artist_id: string } => f.artist_id !== null
    )
    
    // Keep only one folder per artist (the first found)
    const seen = new Set<string>()
    fallbackFolders = validFallbackFolders.filter((f) => {
      if (seen.has(f.artist_id)) return false
      seen.add(f.artist_id)
      return true
    })
  }

  // Build parentId map: artistId → folderId
  const parentIdByArtist = new Map<string, string>()
  for (const f of [...validRootFolders, ...fallbackFolders]) {
    if (!parentIdByArtist.has(f.artist_id)) {
      parentIdByArtist.set(f.artist_id, f.id)
    }
  }

  // Batch-fetch existing "collabs" subfolders for all parent folders
  const parentIds = [...parentIdByArtist.values()]
  const { data: existingCollabs } = await db
    .from('asset_folders')
    .select('id, parent_id')
    .in('parent_id', parentIds)
    .ilike('name', 'collabs')

  // Filter out null parent_id values before creating Map
  const validCollabs = (existingCollabs ?? []).filter(
    (f): f is { id: string; parent_id: string } => f.parent_id !== null
  )

  const collabsByParent = new Map<string, string>(
    validCollabs.map((f) => [f.parent_id, f.id])
  )

  // Batch-insert missing "collabs" folders
  const toInsert = artistIds
    .map((artistId) => {
      const parentId = parentIdByArtist.get(artistId)
      if (!parentId || collabsByParent.has(parentId)) return null
      return { name: 'collabs', parent_id: parentId, artist_id: artistId }
    })
    .filter((row): row is { name: string; parent_id: string; artist_id: string } => row !== null)

  if (toInsert.length > 0) {
    const { data: created } = await db
      .from('asset_folders')
      .upsert(toInsert, { onConflict: 'parent_id,name', ignoreDuplicates: false })
      .select('id, parent_id')
    
    // Filter out null parent_id values before using in Map
    const validCreated = (created ?? []).filter(
      (row): row is { id: string; parent_id: string } => row.parent_id !== null
    )
    
    for (const row of validCreated) {
      collabsByParent.set(row.parent_id, row.id)
    }
  }

  // Set the asset's folder_id if it has none (non-destructive, use the first artist's collabs folder)
  const { data: assetRow } = await db.from('assets').select('folder_id').eq('id', assetId).single()
  if (!assetRow?.folder_id) {
    // Pick the collabs folder of the first artist that has one
    for (const artistId of artistIds) {
      const parentId = parentIdByArtist.get(artistId)
      if (parentId) {
        const collabsFolderId = collabsByParent.get(parentId)
        if (collabsFolderId) {
          await db.from('assets').update({ folder_id: collabsFolderId }).eq('id', assetId)
          break
        }
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
