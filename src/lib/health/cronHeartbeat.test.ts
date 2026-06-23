import { describe, it, expect } from 'vitest'
import { deriveCronHealth } from './cronHeartbeat'
import { CRON_EXECUTE_MISSED_MS } from './thresholds'

const NOW = new Date('2026-06-23T12:00:00.000Z').getTime()

describe('deriveCronHealth', () => {
  it('flags executor as failing when overdue with backlog', () => {
    const result = deriveCronHealth({
      heartbeats: {
        sync_execute: new Date(NOW - CRON_EXECUTE_MISSED_MS - 60_000).toISOString(),
        sync_queue: null,
        sync_youtube: null,
        health_alert: null,
      },
      syncQueue: {
        pending: 5,
        running: 0,
        done: 0,
        failed: 0,
        stuckRunning: 0,
        operationalState: 'degraded',
        statusLabel: 'Backlog',
        statusDetail: 'Pending jobs',
      },
      cronSecretConfigured: true,
      youtubeConfigured: true,
      nowMs: NOW,
    })

    const execute = result.jobs.find((j) => j.key === 'sync_execute')
    expect(execute?.operationalState).toBe('failing')
    expect(result.operationalState).toBe('failing')
  })

  it('reports operational when execute heartbeat is recent', () => {
    const result = deriveCronHealth({
      heartbeats: {
        sync_execute: new Date(NOW - 2 * 60_000).toISOString(),
        sync_queue: new Date(NOW - 3 * 3_600_000).toISOString(),
        sync_youtube: new Date(NOW - 4 * 3_600_000).toISOString(),
        health_alert: new Date(NOW - 5 * 60_000).toISOString(),
      },
      syncQueue: null,
      cronSecretConfigured: true,
      youtubeConfigured: true,
      nowMs: NOW,
    })

    expect(result.operationalState).toBe('operational')
  })
})