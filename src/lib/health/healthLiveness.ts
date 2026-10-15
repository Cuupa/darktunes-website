/**
 * src/lib/health/healthLiveness.ts
 *
 * Lightweight database liveness probe for HEAD / lite health checks.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  DB_LATENCY_CRITICAL_MS,
  DB_LATENCY_WARN_MS,
} from './thresholds'
import type { DatabaseHealth, HealthLivenessResponse } from './types'

export function deriveDatabaseHealth(
  online: boolean,
  latencyMs: number | null,
): DatabaseHealth {
  if (!online) {
    return {
      status: 'offline',
      latencyMs,
      statusLabel: 'Unreachable',
      statusDetail: 'Database ping failed — public reads and sync jobs cannot run.',
    }
  }

  if (latencyMs !== null && latencyMs >= DB_LATENCY_CRITICAL_MS) {
    return {
      status: 'critical',
      latencyMs,
      statusLabel: 'Critical latency',
      statusDetail: `Round-trip ${latencyMs}ms exceeds ${DB_LATENCY_CRITICAL_MS}ms threshold.`,
    }
  }

  if (latencyMs !== null && latencyMs >= DB_LATENCY_WARN_MS) {
    return {
      status: 'slow',
      latencyMs,
      statusLabel: 'Elevated latency',
      statusDetail: `Round-trip ${latencyMs}ms exceeds ${DB_LATENCY_WARN_MS}ms warning threshold.`,
    }
  }

  return {
    status: 'online',
    latencyMs,
    statusLabel: 'Connected',
    statusDetail:
      latencyMs !== null
        ? `Healthy connection · ${latencyMs}ms round-trip`
        : 'Healthy connection',
  }
}

export async function checkDatabaseLiveness(
  db: SupabaseClient<Database> | null,
): Promise<DatabaseHealth> {
  if (!db) {
    return deriveDatabaseHealth(false, null)
  }

  try {
    const start = Date.now()
    // Probe a neutral core table, never the log tables — a broken log table must
    // not be reported as "database offline" (see checkLogStore).
    const { error } = await db.from('artists').select('id').limit(1)
    const latencyMs = Date.now() - start
    return deriveDatabaseHealth(!error, latencyMs)
  } catch {
    return deriveDatabaseHealth(false, null)
  }
}

export interface LogStoreHealth {
  readable: boolean
  detail: string
}

/**
 * Probes the log tables for schema drift (missing columns) or read failures.
 * Never throws — a broken log store must not take down the health endpoint.
 */
export async function checkLogStore(
  db: SupabaseClient<Database> | null,
): Promise<LogStoreHealth> {
  if (!db) return { readable: false, detail: 'Database client unavailable.' }

  try {
    const appLogs = await db
      .from('app_logs')
      .select('fingerprint, last_seen_at, route_path')
      .limit(1)
    if (appLogs.error) {
      return { readable: false, detail: `app_logs unreadable: ${appLogs.error.message}` }
    }

    const syncLogs = await db.from('sync_logs').select('duration_ms, metadata').limit(1)
    if (syncLogs.error) {
      return { readable: false, detail: `sync_logs unreadable: ${syncLogs.error.message}` }
    }

    return { readable: true, detail: 'Log tables readable.' }
  } catch (error) {
    return {
      readable: false,
      detail: `Log store probe failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

export async function buildHealthLivenessResponse(
  db: SupabaseClient<Database> | null,
): Promise<HealthLivenessResponse> {
  const database = await checkDatabaseLiveness(db)
  const logs = await checkLogStore(db)
  return {
    status: database.status === 'offline' ? 'offline' : 'ok',
    database,
    logs,
    checkedAt: new Date().toISOString(),
  }
}