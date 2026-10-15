import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { SyncLog } from '@/types'
import { writeAppLog } from '@/lib/appLog'

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
    durationMs: row.duration_ms ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
  }
}

export async function insertSyncLog(db: DbClient, log: SyncLogInsert): Promise<SyncLog> {
  const { data, error } = await db.from('sync_logs').insert(log).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from insertSyncLog')
  return rowToSyncLog(data)
}

/**
 * Best-effort sync_logs write for sync runs. Never throws, so callers can keep
 * the "sync never throws" contract. A failed insert is reported to app_logs and
 * the console instead of disappearing. Returns true when the row was persisted.
 */
export async function recordSyncLog(db: DbClient, log: SyncLogInsert): Promise<boolean> {
  try {
    await insertSyncLog(db, log)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const apiSource = log.api_source ?? 'unknown'
    console.error(`[recordSyncLog] ${apiSource} sync log insert failed:`, message)
    await writeAppLog({
      source: 'sync',
      level: 'error',
      message: `sync_logs insert failed (${apiSource}): ${message}`,
      details: { api_source: apiSource, status: log.status ?? null },
    })
    return false
  }
}
