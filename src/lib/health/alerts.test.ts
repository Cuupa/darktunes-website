import { describe, it, expect } from 'vitest'
import {
  buildHealthAlerts,
  computeHealthScore,
  computeKpiSummary,
  deriveUnavailableApiHealth,
  sortAlerts,
} from './alerts'
import type { ApiHealthStatus, DatabaseHealth } from './types'

const NOW = '2026-06-23T12:00:00.000Z'

function makeApi(overrides: Partial<ApiHealthStatus> = {}): ApiHealthStatus {
  return {
    configured: true,
    operationalState: 'operational',
    statusLabel: 'Operational',
    statusDetail: 'OK',
    lastSyncAt: NOW,
    lastSyncStatus: 'success',
    rateLimited: false,
    lastErrors: [],
    durationMs: 1000,
    releasesSynced: 1,
    concertsSynced: null,
    artistsProcessed: null,
    errorCount: 0,
    stats24h: { total: 5, success: 5, partial: 0, error: 0, successRate: 100 },
    ...overrides,
  }
}

const healthyDb: DatabaseHealth = {
  status: 'online',
  latencyMs: 120,
  statusLabel: 'Connected',
  statusDetail: 'Healthy',
}

describe('deriveUnavailableApiHealth', () => {
  it('returns unavailable state', () => {
    const result = deriveUnavailableApiHealth()
    expect(result.operationalState).toBe('unavailable')
    expect(result.statusLabel).toBe('Status unavailable')
  })
})

describe('computeHealthScore', () => {
  it('returns 0 when database is offline', () => {
    const score = computeHealthScore(
      { status: 'offline', latencyMs: null, statusLabel: 'Unreachable', statusDetail: '' },
      { itunes: makeApi() },
      null,
    )
    expect(score).toBe(0)
  })

  it('deducts for failing APIs and queue', () => {
    const score = computeHealthScore(
      healthyDb,
      {
        itunes: makeApi({ operationalState: 'failing' }),
        spotify: makeApi({ operationalState: 'operational' }),
      },
      {
        pending: 0,
        running: 0,
        done: 0,
        failed: 3,
        stuckRunning: 1,
        operationalState: 'failing',
        statusLabel: 'Stuck',
        statusDetail: 'Stuck jobs',
      },
    )
    expect(score).toBeLessThan(100)
    expect(score).toBeGreaterThanOrEqual(0)
  })
})

describe('computeKpiSummary', () => {
  it('aggregates API states', () => {
    const kpis = computeKpiSummary({
      itunes: makeApi({ operationalState: 'operational' }),
      spotify: makeApi({ configured: false, operationalState: 'unconfigured' }),
      discogs: makeApi({ operationalState: 'failing' }),
    })
    expect(kpis.configuredApis).toBe(2)
    expect(kpis.operationalApis).toBe(1)
    expect(kpis.failingApis).toBe(1)
    expect(kpis.unconfiguredApis).toBe(1)
    expect(kpis.avgSuccessRate24h).toBe(100)
  })
})

describe('buildHealthAlerts', () => {
  it('creates critical alert for offline database', () => {
    const alerts = buildHealthAlerts(
      { status: 'offline', latencyMs: null, statusLabel: 'Unreachable', statusDetail: 'Down' },
      { itunes: makeApi() },
      null,
      computeKpiSummary({ itunes: makeApi() }),
    )
    expect(alerts.some((a) => a.severity === 'critical' && a.source === 'database')).toBe(true)
  })

  it('creates SLA warning when success rate is low', () => {
    const apis = {
      spotify: makeApi({
        stats24h: { total: 10, success: 6, partial: 2, error: 2, successRate: 60 },
      }),
    }
    const alerts = buildHealthAlerts(healthyDb, apis, null, computeKpiSummary(apis))
    expect(alerts.some((a) => a.id === 'api-spotify-sla-warn')).toBe(true)
  })
})

describe('sortAlerts', () => {
  it('orders critical before warning before info', () => {
    const sorted = sortAlerts([
      { id: 'i', severity: 'info', title: 'Info', message: '', source: 'system' },
      { id: 'c', severity: 'critical', title: 'Crit', message: '', source: 'database' },
      { id: 'w', severity: 'warning', title: 'Warn', message: '', source: 'itunes' },
    ])
    expect(sorted.map((a) => a.severity)).toEqual(['critical', 'warning', 'info'])
  })
})