/**
 * src/lib/health/cronHeartbeat.ts
 *
 * Derives scheduler/worker health from persisted `cron_ticks`.
 *
 * The scheduler tick (pg_cron, pure SQL) and the worker tick (HTTP hop reached
 * Next.js) are compared so the broken link is identifiable:
 *   - scheduler stale + worker stale → pg_cron is not running
 *   - scheduler fresh + worker stale → the HTTP hop is broken (URL/secret)
 *   - worker fresh + backlog         → the worker is failing
 */

import {
  CRON_DAILY_STALE_MS,
  CRON_EXECUTE_MISSED_MS,
  HEALTH_ALERT_INTERVAL_MS,
} from './thresholds'
import type { HealthHeartbeats, HealthHeartbeatKey } from './heartbeats'
import type { SyncQueueHealth } from './types'

export type CronOperationalState = 'operational' | 'degraded' | 'failing' | 'idle' | 'unconfigured'

export interface CronJobHealth {
  key: HealthHeartbeatKey
  label: string
  configured: boolean
  lastHeartbeatAt: string | null
  operationalState: CronOperationalState
  statusLabel: string
  statusDetail: string
}

export interface CronHealthSummary {
  jobs: CronJobHealth[]
  operationalState: CronOperationalState
  statusLabel: string
  statusDetail: string
}

export interface CronHealthContext {
  heartbeats: HealthHeartbeats
  syncQueue: SyncQueueHealth | null
  cronSecretConfigured: boolean
  youtubeConfigured: boolean
  nowMs?: number
}

function ageMs(iso: string | null, nowMs: number): number | null {
  if (!iso) return null
  return nowMs - new Date(iso).getTime()
}

function isFresh(iso: string | null, nowMs: number, maxAgeMs: number): boolean {
  const age = ageMs(iso, nowMs)
  return age !== null && age <= maxAgeMs
}

function deriveSchedulerCron(
  lastAt: string | null,
  configured: boolean,
  nowMs: number,
): CronJobHealth {
  const base = {
    key: 'scheduler' as const,
    label: 'Scheduler',
    configured,
    lastHeartbeatAt: lastAt,
  }

  if (!configured) {
    return {
      ...base,
      operationalState: 'unconfigured',
      statusLabel: 'Automatic sync unavailable',
      statusDetail: 'Background sync is not armed. Contact your technical operator.',
    }
  }

  const age = ageMs(lastAt, nowMs)
  if (age === null) {
    return {
      ...base,
      operationalState: 'idle',
      statusLabel: 'Awaiting first tick',
      statusDetail: 'The scheduler has not reported a tick yet.',
    }
  }

  if (age > CRON_EXECUTE_MISSED_MS) {
    return {
      ...base,
      operationalState: 'failing',
      statusLabel: 'Scheduler offline',
      statusDetail: `The scheduler has not run for ${Math.floor(age / 60_000)}m — automatic sync is not being triggered. Contact your technical operator.`,
    }
  }

  return {
    ...base,
    operationalState: 'operational',
    statusLabel: 'Scheduler active',
    statusDetail: `Last tick ${Math.max(1, Math.floor(age / 60_000))}m ago.`,
  }
}

function deriveWorkerCron(
  lastAt: string | null,
  syncQueue: SyncQueueHealth | null,
  configured: boolean,
  schedulerFresh: boolean,
  nowMs: number,
): CronJobHealth {
  const base = {
    key: 'worker' as const,
    label: 'Sync executor',
    configured,
    lastHeartbeatAt: lastAt,
  }

  if (!configured) {
    return {
      ...base,
      operationalState: 'unconfigured',
      statusLabel: 'Automatic sync unavailable',
      statusDetail: 'Background sync is not armed. Contact your technical operator.',
    }
  }

  const age = ageMs(lastAt, nowMs)
  const backlog =
    (syncQueue?.pending ?? 0) + (syncQueue?.running ?? 0) + (syncQueue?.stuckRunning ?? 0)

  if (age === null) {
    return {
      ...base,
      operationalState: backlog > 0 ? 'failing' : 'idle',
      statusLabel: backlog > 0 ? 'Executor never ran' : 'Awaiting first run',
      statusDetail:
        backlog > 0
          ? `${backlog} queue job(s) waiting but automatic processing has not started yet.`
          : 'No automatic sync run recorded yet.',
    }
  }

  if (age > CRON_EXECUTE_MISSED_MS) {
    const minutes = Math.floor(age / 60_000)
    if (schedulerFresh) {
      return {
        ...base,
        operationalState: 'failing',
        statusLabel: 'Executor unreachable',
        statusDetail: `The scheduler is running but background sync has not reached the app for ${minutes}m${backlog > 0 ? ` with ${backlog} job(s) waiting` : ''}. Contact your technical operator.`,
      }
    }
    if (backlog > 0) {
      return {
        ...base,
        operationalState: 'failing',
        statusLabel: 'Executor offline',
        statusDetail: `Last run ${minutes}m ago with ${backlog} active queue job(s) — automatic processing may be stalled.`,
      }
    }
    return {
      ...base,
      operationalState: 'degraded',
      statusLabel: 'Executor overdue',
      statusDetail: `Last run ${minutes}m ago — queue is idle.`,
    }
  }

  return {
    ...base,
    operationalState: 'operational',
    statusLabel: 'Executor active',
    statusDetail: `Last invoke ${Math.max(1, Math.floor(age / 60_000))}m ago.`,
  }
}

function deriveDailyCron(
  key: 'queue' | 'youtube',
  label: string,
  lastAt: string | null,
  configured: boolean,
  nowMs: number,
): CronJobHealth {
  const base = { key, label, configured, lastHeartbeatAt: lastAt }

  if (!configured) {
    return {
      ...base,
      operationalState: 'unconfigured',
      statusLabel: 'Not configured',
      statusDetail: `Required credentials for ${label} are missing — check Admin → API Keys.`,
    }
  }

  const age = ageMs(lastAt, nowMs)
  if (age === null) {
    return {
      ...base,
      operationalState: 'idle',
      statusLabel: 'Awaiting first run',
      statusDetail: `No run recorded yet for ${label}.`,
    }
  }

  if (age > CRON_DAILY_STALE_MS) {
    const hours = Math.floor(age / 3_600_000)
    return {
      ...base,
      operationalState: 'degraded',
      statusLabel: 'Daily job overdue',
      statusDetail: `Last run ${hours}h ago — expected within 36h.`,
    }
  }

  return {
    ...base,
    operationalState: 'operational',
    statusLabel: 'On schedule',
    statusDetail: `Last run ${Math.floor(age / 3_600_000)}h ago.`,
  }
}

function deriveAlertCron(
  lastAt: string | null,
  configured: boolean,
  nowMs: number,
): CronJobHealth {
  const base = {
    key: 'health_alert' as const,
    label: 'Alert checker',
    configured,
    lastHeartbeatAt: lastAt,
  }

  if (!configured) {
    return {
      ...base,
      operationalState: 'unconfigured',
      statusLabel: 'Alerts not armed',
      statusDetail: 'Proactive alerts are not available. Contact your technical operator.',
    }
  }

  const age = ageMs(lastAt, nowMs)
  const grace = HEALTH_ALERT_INTERVAL_MS * 2.5

  if (age === null) {
    return {
      ...base,
      operationalState: 'idle',
      statusLabel: 'Awaiting first check',
      statusDetail: 'Proactive alerts have not run yet.',
    }
  }

  if (age > grace) {
    return {
      ...base,
      operationalState: 'degraded',
      statusLabel: 'Alert checker overdue',
      statusDetail: `Last check ${Math.floor(age / 60_000)}m ago — expected every 10m.`,
    }
  }

  return {
    ...base,
    operationalState: 'operational',
    statusLabel: 'Alert checker active',
    statusDetail: `Last check ${Math.max(1, Math.floor(age / 60_000))}m ago.`,
  }
}

const CRON_SEVERITY: Record<CronOperationalState, number> = {
  operational: 0,
  idle: 1,
  unconfigured: 1,
  degraded: 2,
  failing: 4,
}

export function deriveCronHealth(ctx: CronHealthContext): CronHealthSummary {
  const nowMs = ctx.nowMs ?? Date.now()
  const cronConfigured = ctx.cronSecretConfigured
  const schedulerFresh = isFresh(
    ctx.heartbeats.scheduler,
    nowMs,
    CRON_EXECUTE_MISSED_MS,
  )

  const jobs: CronJobHealth[] = [
    deriveSchedulerCron(ctx.heartbeats.scheduler, cronConfigured, nowMs),
    deriveWorkerCron(
      ctx.heartbeats.worker,
      ctx.syncQueue,
      cronConfigured,
      schedulerFresh,
      nowMs,
    ),
    deriveDailyCron('queue', 'Daily sync enqueue', ctx.heartbeats.queue, cronConfigured, nowMs),
    deriveDailyCron(
      'youtube',
      'YouTube sync',
      ctx.heartbeats.youtube,
      ctx.youtubeConfigured,
      nowMs,
    ),
    deriveAlertCron(ctx.heartbeats.health_alert, cronConfigured, nowMs),
  ]

  const maxSeverity = jobs.reduce(
    (max, job) => Math.max(max, CRON_SEVERITY[job.operationalState]),
    0,
  )

  const failing = jobs.filter((j) => j.operationalState === 'failing')
  const degraded = jobs.filter(
    (j) => j.operationalState === 'degraded' || j.operationalState === 'failing',
  )

  if (maxSeverity >= 4) {
    return {
      jobs,
      operationalState: 'failing',
      statusLabel: 'Cron failure',
      statusDetail: failing.map((j) => j.statusLabel).join(' · '),
    }
  }

  if (maxSeverity >= 2) {
    return {
      jobs,
      operationalState: 'degraded',
      statusLabel: 'Cron degraded',
      statusDetail:
        degraded.length > 0
          ? `${degraded.length} scheduled job${degraded.length === 1 ? '' : 's'} need review.`
          : 'One or more cron heartbeats are overdue.',
    }
  }

  return {
    jobs,
    operationalState: 'operational',
    statusLabel: 'Crons on schedule',
    statusDetail: 'All configured schedulers report recent heartbeats.',
  }
}
