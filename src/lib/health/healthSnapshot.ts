/**
 * src/lib/health/healthSnapshot.ts
 *
 * Builds the full enterprise health snapshot from Supabase data.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { countStuckSyncJobs, getSyncQueueStats } from '@/lib/api/syncQueue'
import {
  buildHealthAlerts,
  computeHealthScore,
  computeKpiSummary,
  deriveUnavailableApiHealth,
} from './alerts'
import { deriveCronHealth } from './cronHeartbeat'
import { getHealthHeartbeats } from './heartbeats'
import {
  deriveApiHealth,
  deriveOverallHealth,
  deriveSyncQueueHealth,
  parseSyncLogSnapshot,
  sortApiSources,
  type ApiOperationalState,
} from './apiStatus'
import {
  DB_LATENCY_CRITICAL_MS,
  DB_LATENCY_WARN_MS,
  HEALTH_LOG_FETCH_LIMIT,
  HEALTH_LOG_LOOKBACK_MS,
} from './thresholds'
import type { CronHealthSummary } from './cronHeartbeat'
import type {
  ApiHealthStatus,
  ApiRunStats24h,
  DatabaseHealth,
  HealthResponse,
  SyncQueueHealth,
} from './types'
import { getKnownApiConfiguration } from '@/lib/secrets/getExternalCredentials'

/** Fallback when DB is unavailable — only always-on APIs marked configured. */
export function getKnownApisFallback(): Record<string, boolean> {
  return {
    itunes: true,
    spotify: false,
    discogs: false,
    songkick: false,
    bandsintown: false,
    odesli: true,
    lastfm: false,
    soundcharts: false,
    youtube: false,
  }
}

interface SyncLogRow {
  api_source: string
  created_at: string
  status: string
  rate_limited: boolean
  errors: unknown
  duration_ms: number | null
  releases_synced: number
  metadata: unknown
}

function emptyStats24h(): ApiRunStats24h {
  return { total: 0, success: 0, partial: 0, error: 0, successRate: null }
}

function accumulateStats24h(
  stats: Map<string, ApiRunStats24h>,
  api: string,
  status: string,
  cutoff24hMs: number,
  createdAtMs: number,
): void {
  if (createdAtMs < cutoff24hMs) return

  const current = stats.get(api) ?? emptyStats24h()
  current.total++

  if (status === 'success') current.success++
  else if (status === 'partial') current.partial++
  else if (status === 'error') current.error++

  stats.set(api, current)
}

function finalizeStats24h(stats: Map<string, ApiRunStats24h>): Map<string, ApiRunStats24h> {
  const result = new Map<string, ApiRunStats24h>()
  for (const [api, raw] of stats) {
    const successRate =
      raw.total > 0 ? Math.round((raw.success / raw.total) * 100) : null
    result.set(api, { ...raw, successRate })
  }
  return result
}

function deriveDatabaseHealth(
  online: boolean,
  latencyMs: number | null,
): DatabaseHealth {
  if (!online) {
    return {
      status: 'offline',
      latencyMs,
      statusLabel: 'Unreachable',
      statusDetail: 'Supabase ping failed — public reads and sync jobs cannot run.',
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

function buildUnavailableApis(knownApis: Record<string, boolean>): Record<string, ApiHealthStatus> {
  const unavailable = deriveUnavailableApiHealth()
  const apis: Record<string, ApiHealthStatus> = {}

  for (const api of sortApiSources(Object.keys(knownApis))) {
    apis[api] = {
      configured: knownApis[api],
      operationalState: unavailable.operationalState,
      statusLabel: unavailable.statusLabel,
      statusDetail: unavailable.statusDetail,
      lastSyncAt: null,
      lastSyncStatus: null,
      rateLimited: false,
      lastErrors: [],
      durationMs: null,
      releasesSynced: null,
      concertsSynced: null,
      artistsProcessed: null,
      errorCount: 0,
      stats24h: emptyStats24h(),
    }
  }

  return apis
}

export interface BuildHealthSnapshotDeps {
  db: SupabaseClient<Database> | null
  knownApis?: Record<string, boolean>
  nowMs?: number
}

export async function buildHealthSnapshot(
  deps: BuildHealthSnapshotDeps,
): Promise<HealthResponse> {
  const checkedAt = new Date().toISOString()
  const nowMs = deps.nowMs ?? Date.now()
  const knownApis =
    deps.knownApis ??
    (deps.db ? await getKnownApiConfiguration(deps.db) : getKnownApisFallback())
  const cutoffLookback = new Date(nowMs - HEALTH_LOG_LOOKBACK_MS).toISOString()
  const cutoff24hMs = nowMs - 24 * 60 * 60 * 1000

  let database = deriveDatabaseHealth(false, null)
  let apis: Record<string, ApiHealthStatus> = buildUnavailableApis(knownApis)
  let syncQueueHealth: SyncQueueHealth | null = null
  let cronHealth: CronHealthSummary | null = null

  if (deps.db) {
    try {
      const start = Date.now()
      const { error: pingError } = await deps.db.from('sync_logs').select('id').limit(1)
      const latencyMs = Date.now() - start
      const dbOnline = !pingError

      database = deriveDatabaseHealth(dbOnline, latencyMs)

      if (dbOnline) {
        const { data: logs } = await deps.db
          .from('sync_logs')
          .select(
            'api_source, created_at, status, rate_limited, errors, duration_ms, releases_synced, metadata',
          )
          .gte('created_at', cutoffLookback)
          .order('created_at', { ascending: false })
          .limit(HEALTH_LOG_FETCH_LIMIT)

        const latestPerApi = new Map<string, ReturnType<typeof parseSyncLogSnapshot>>()
        const statsAccumulator = new Map<string, ApiRunStats24h>()

        for (const row of (logs ?? []) as SyncLogRow[]) {
          if (!latestPerApi.has(row.api_source)) {
            latestPerApi.set(row.api_source, parseSyncLogSnapshot(row))
          }
          accumulateStats24h(
            statsAccumulator,
            row.api_source,
            row.status,
            cutoff24hMs,
            new Date(row.created_at).getTime(),
          )
        }

        const stats24h = finalizeStats24h(statsAccumulator)
        const allApis = sortApiSources([
          ...new Set([...Object.keys(knownApis), ...latestPerApi.keys()]),
        ])

        const builtApis: Record<string, ApiHealthStatus> = {}

        for (const api of allApis) {
          const snapshot = latestPerApi.get(api) ?? null
          const configured = knownApis[api] ?? false
          const derived = deriveApiHealth(api, configured, snapshot, nowMs)
          const apiStats = stats24h.get(api) ?? emptyStats24h()

          builtApis[api] = {
            configured,
            operationalState: derived.operationalState,
            statusLabel: derived.statusLabel,
            statusDetail: derived.statusDetail,
            lastSyncAt: snapshot?.createdAt ?? null,
            lastSyncStatus: snapshot?.status ?? null,
            rateLimited: snapshot?.rateLimited ?? false,
            lastErrors: snapshot?.errors ?? [],
            durationMs: snapshot?.durationMs ?? null,
            releasesSynced: snapshot?.releasesSynced ?? null,
            concertsSynced: snapshot?.concertsSynced ?? null,
            artistsProcessed: snapshot?.artistsProcessed ?? null,
            errorCount: snapshot?.errors.length ?? 0,
            stats24h: apiStats,
          }
        }

        apis = builtApis

        const [queueStats, stuckRunning] = await Promise.all([
          getSyncQueueStats(deps.db),
          countStuckSyncJobs(deps.db),
        ])
        const queueDerived = deriveSyncQueueHealth({ ...queueStats, stuckRunning })
        syncQueueHealth = {
          ...queueStats,
          stuckRunning,
          operationalState: queueDerived.operationalState,
          statusLabel: queueDerived.statusLabel,
          statusDetail: queueDerived.statusDetail,
        }

        const heartbeats = await getHealthHeartbeats(deps.db)
        cronHealth = deriveCronHealth({
          heartbeats,
          syncQueue: syncQueueHealth,
          cronSecretConfigured: Boolean(process.env.CRON_SECRET),
          youtubeConfigured: knownApis.youtube ?? false,
          nowMs,
        })
      }
    } catch {
      database = deriveDatabaseHealth(false, null)
      apis = buildUnavailableApis(knownApis)
    }
  }

  const configuredApiStates = Object.entries(apis)
    .filter(([api, s]) => s.configured && api !== 'all')
    .map(([, s]) => s.operationalState as ApiOperationalState)

  let overall = deriveOverallHealth(
    database.status !== 'offline',
    configuredApiStates.filter((s) => s !== 'unavailable'),
    syncQueueHealth?.operationalState ?? null,
  )

  if (cronHealth?.operationalState === 'failing') {
    overall = {
      status: 'unhealthy',
      statusLabel: 'Cron scheduler failure',
      statusDetail: cronHealth.statusDetail,
    }
  } else if (
    cronHealth?.operationalState === 'degraded' &&
    overall.status === 'healthy'
  ) {
    overall = {
      status: 'degraded',
      statusLabel: 'Cron scheduler degraded',
      statusDetail: cronHealth.statusDetail,
    }
  }

  const kpis = computeKpiSummary(apis)
  const alerts = buildHealthAlerts(database, apis, syncQueueHealth, kpis, cronHealth)
  const healthScore = computeHealthScore(database, apis, syncQueueHealth, cronHealth)

  return {
    status: overall.status,
    statusLabel: overall.statusLabel,
    statusDetail: overall.statusDetail,
    healthScore,
    database,
    apis,
    syncQueue: syncQueueHealth,
    cronHealth,
    kpis,
    alerts,
    checkedAt,
  }
}