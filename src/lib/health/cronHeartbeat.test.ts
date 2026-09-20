import { describe, it, expect } from 'vitest'
import { deriveCronHealth } from './cronHeartbeat'
import { CRON_EXECUTE_MISSED_MS } from './thresholds'

const NOW = new Date('2026-06-23T12:00:00.000Z').getTime()

const BACKLOG = {
  pending: 5,
  running: 0,
  done: 0,
  failed: 0,
  stuckRunning: 0,
  operationalState: 'degraded' as const,
  statusLabel: 'Backlog',
  statusDetail: 'Pending jobs',
}

describe('deriveCronHealth', () => {
  it('flags executor as failing when overdue with backlog and no scheduler', () => {
    const result = deriveCronHealth({
      heartbeats: {
        scheduler: null,
        worker: new Date(NOW - CRON_EXECUTE_MISSED_MS - 60_000).toISOString(),
        queue: null,
        youtube: null,
        health_alert: null,
      },
      syncQueue: BACKLOG,
      cronSecretConfigured: true,
      youtubeConfigured: true,
      nowMs: NOW,
    })

    const worker = result.jobs.find((j) => j.key === 'worker')
    expect(worker?.operationalState).toBe('failing')
    expect(result.operationalState).toBe('failing')
  })

  it('reports operational when all heartbeats are recent', () => {
    const result = deriveCronHealth({
      heartbeats: {
        scheduler: new Date(NOW - 60_000).toISOString(),
        worker: new Date(NOW - 2 * 60_000).toISOString(),
        queue: new Date(NOW - 3 * 3_600_000).toISOString(),
        youtube: new Date(NOW - 4 * 3_600_000).toISOString(),
        health_alert: new Date(NOW - 5 * 60_000).toISOString(),
      },
      syncQueue: null,
      cronSecretConfigured: true,
      youtubeConfigured: true,
      nowMs: NOW,
    })

    expect(result.operationalState).toBe('operational')
  })

  it('distinguishes a live scheduler with an unreachable worker', () => {
    const result = deriveCronHealth({
      heartbeats: {
        scheduler: new Date(NOW - 60_000).toISOString(),
        worker: new Date(NOW - CRON_EXECUTE_MISSED_MS - 60_000).toISOString(),
        queue: null,
        youtube: null,
        health_alert: null,
      },
      syncQueue: BACKLOG,
      cronSecretConfigured: true,
      youtubeConfigured: true,
      nowMs: NOW,
    })

    const worker = result.jobs.find((j) => j.key === 'worker')
    expect(worker?.statusLabel).toBe('Executor unreachable')
    expect(result.operationalState).toBe('failing')
  })

  it('flags the scheduler when pg_cron itself is stale', () => {
    const result = deriveCronHealth({
      heartbeats: {
        scheduler: new Date(NOW - CRON_EXECUTE_MISSED_MS - 60_000).toISOString(),
        worker: null,
        queue: null,
        youtube: null,
        health_alert: null,
      },
      syncQueue: null,
      cronSecretConfigured: true,
      youtubeConfigured: true,
      nowMs: NOW,
    })

    const scheduler = result.jobs.find((j) => j.key === 'scheduler')
    expect(scheduler?.statusLabel).toBe('Scheduler offline')
    expect(result.operationalState).toBe('failing')
  })
})
