import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { JournalistDownload } from '@/types'

type DbClient = SupabaseClient<Database>
type DownloadRow = Database['public']['Tables']['journalist_downloads']['Row']
type DownloadInsert = Database['public']['Tables']['journalist_downloads']['Insert']

function rowToDownload(row: DownloadRow): JournalistDownload {
  return {
    id: row.id,
    journalistId: row.journalist_id,
    releaseId: row.release_id,
    assetId: row.asset_id ?? undefined,
    assetKey: row.asset_key,
    downloadedAt: row.downloaded_at,
  }
}

export async function logDownload(
  db: DbClient,
  data: DownloadInsert,
): Promise<JournalistDownload> {
  const { data: row, error } = await db
    .from('journalist_downloads')
    .insert(data)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from logDownload')
  return rowToDownload(row)
}

export async function getDownloadHistory(
  db: DbClient,
  journalistId: string,
): Promise<JournalistDownload[]> {
  const { data, error } = await db
    .from('journalist_downloads')
    .select('*')
    .eq('journalist_id', journalistId)
    .order('downloaded_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToDownload)
}

export interface ArtistPressDownloadStats {
  totalDownloads: number
  last30Days: number
  uniqueJournalists: number
  recentDownloads: JournalistDownload[]
}

async function collectArtistAssetAndReleaseIds(
  db: DbClient,
  artistId: string,
): Promise<{ releaseIds: string[]; assetIds: string[] }> {
  const [releaseRows, directAssets, linkedAssets] = await Promise.all([
    db.from('release_artists').select('release_id').eq('artist_id', artistId),
    db.from('assets').select('id').eq('artist_id', artistId),
    db.from('asset_artists').select('asset_id').eq('artist_id', artistId),
  ])

  if (releaseRows.error) throw new Error(releaseRows.error.message)
  if (directAssets.error) throw new Error(directAssets.error.message)
  if (linkedAssets.error) throw new Error(linkedAssets.error.message)

  const releaseIds = (releaseRows.data ?? []).map((r) => r.release_id)
  const assetIds = [
    ...new Set([
      ...(directAssets.data ?? []).map((a) => a.id),
      ...(linkedAssets.data ?? []).map((a) => a.asset_id),
    ]),
  ]

  return { releaseIds, assetIds }
}

/**
 * Press-kit downloads linked to an artist via releases or assets.
 *
 * Ids are batched into separate `.in()` queries instead of one giant `.or()`
 * string: a filter URL with hundreds of ids exceeds the PostgREST/browser limit.
 */
export async function getDownloadsByArtistId(
  db: DbClient,
  artistId: string,
  limit = 100,
): Promise<JournalistDownload[]> {
  const { releaseIds, assetIds } = await collectArtistAssetAndReleaseIds(db, artistId)

  const ID_BATCH_SIZE = 50
  const batches: Array<{ column: 'release_id' | 'asset_id'; ids: string[] }> = []
  const queue = (column: 'release_id' | 'asset_id', ids: string[]) => {
    for (let i = 0; i < ids.length; i += ID_BATCH_SIZE) {
      batches.push({ column, ids: ids.slice(i, i + ID_BATCH_SIZE) })
    }
  }
  queue('release_id', releaseIds)
  queue('asset_id', assetIds)
  if (batches.length === 0) return []

  const results = await Promise.all(
    batches.map(({ column, ids }) =>
      db
        .from('journalist_downloads')
        .select('*')
        .in(column, ids)
        .order('downloaded_at', { ascending: false })
        .limit(limit),
    ),
  )
  const byId = new Map<string, JournalistDownload>()
  for (const res of results) {
    if (res.error) throw new Error(res.error.message)
    for (const row of res.data ?? []) {
      const download = rowToDownload(row)
      if (!byId.has(download.id)) byId.set(download.id, download)
    }
  }

  return [...byId.values()]
    .sort((a, b) => (a.downloadedAt < b.downloadedAt ? 1 : a.downloadedAt > b.downloadedAt ? -1 : 0))
    .slice(0, limit)
}

export async function getAllJournalistDownloads(
  db: DbClient,
  limit = 2000,
): Promise<JournalistDownload[]> {
  const { data, error } = await db
    .from('journalist_downloads')
    .select('*')
    .order('downloaded_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToDownload)
}

export async function getPressDownloadStatsByArtistId(
  db: DbClient,
  artistId: string,
): Promise<ArtistPressDownloadStats> {
  const downloads = await getDownloadsByArtistId(db, artistId, 500)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()
  const last30Days = downloads.filter((d) => d.downloadedAt >= thirtyDaysAgo).length
  const uniqueJournalists = new Set(downloads.map((d) => d.journalistId)).size

  return {
    totalDownloads: downloads.length,
    last30Days,
    uniqueJournalists,
    recentDownloads: downloads.slice(0, 10),
  }
}
