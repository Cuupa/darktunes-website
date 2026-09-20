/**
 * src/lib/health/heartbeats.ts
 *
 * Liveness ticks persisted in the `cron_ticks` table (append-only).
 *
 * Unlike the previous read-modify-write JSON blob in `site_settings`, appends
 * never clobber each other, so concurrent schedulers/workers cannot wipe
 * evidence. Health reads the latest tick per kind.
 *
 * Kinds:
 *   scheduler    — pg_cron itself is alive (written by a pure-SQL cron job)
 *   worker       — the HTTP hop reached the Next.js sync worker
 *   queue        — the daily enqueue route ran
 *   youtube      — the YouTube sync route ran
 *   health_alert — the proactive alert dispatcher ran
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type HealthHeartbeatKey =
  | 'scheduler'
  | 'worker'
  | 'queue'
  | 'youtube'
  | 'health_alert'

export type HealthHeartbeats = Record<HealthHeartbeatKey, string | null>

const HEARTBEAT_KINDS: HealthHeartbeatKey[] = [
  'scheduler',
  'worker',
  'queue',
  'youtube',
  'health_alert',
]

const EMPTY_HEARTBEATS: HealthHeartbeats = {
  scheduler: null,
  worker: null,
  queue: null,
  youtube: null,
  health_alert: null,
}

export async function getHealthHeartbeats(
  db: SupabaseClient<Database>,
): Promise<HealthHeartbeats> {
  const entries = await Promise.all(
    HEARTBEAT_KINDS.map(async (kind) => {
      const { data, error } = await db
        .from('cron_ticks')
        .select('created_at')
        .eq('kind', kind)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        throw new Error(`Failed to read ${kind} heartbeat: ${error.message}`)
      }
      return [kind, data?.created_at ?? null] as const
    }),
  )

  const result = { ...EMPTY_HEARTBEATS }
  for (const [kind, at] of entries) {
    result[kind] = at
  }
  return result
}

/**
 * Appends a liveness tick. Non-fatal — telemetry must never break the caller.
 * The database stamps `created_at` authoritatively.
 */
export async function recordHealthHeartbeat(
  db: SupabaseClient<Database>,
  key: HealthHeartbeatKey,
): Promise<void> {
  const { error } = await db.from('cron_ticks').insert({ kind: key, status: 'ok' })
  if (error) {
    console.error(`[recordHealthHeartbeat] ${key} failed:`, error.message)
  }
}
