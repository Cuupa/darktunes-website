import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { SyncLog } from '@/types'

type DbClient = SupabaseClient<Database>
type SyncLogRow = Database['public']['Tables']['sync_logs']['Row']
export type SyncLogInsert = Database['public']['Tables']['sync_logs']['Insert']

function rowToSyncLog(row: SyncLogRow): SyncLog {
  return {
    id: row.id,
    artistId: row.artist_id ?? '',
    status: row.status,
    message: row.message,
    releasesSynced: row.releases_synced,
    errors: row.errors,
    apiSource: row.api_source,
    rateLimited: row.rate_limited,
    createdAt: row.created_at,
  }
}

export async function getSyncLogsByArtist(
  db: DbClient,
  artistId: string,
  limit = 10,
): Promise<SyncLog[]> {
  const { data, error } = await db
    .from('sync_logs')
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToSyncLog)
}

export async function insertSyncLog(db: DbClient, log: SyncLogInsert): Promise<SyncLog> {
  const { data, error } = await db.from('sync_logs').insert(log).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from insertSyncLog')
  return rowToSyncLog(data)
}
