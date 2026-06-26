import { describe, it, expect } from 'vitest'
import {
  deriveApiHealth,
  deriveOverallHealth,
  deriveSyncQueueHealth,
  formatDurationMs,
  parseSyncLogSnapshot,
  sortApiSources,
  STALE_SYNC_MS,
} from './apiStatus'

const NOW = new Date('2026-06-23T12:00:00.000Z').getTime()

function makeSnapshot(overrides: Partial<Parameters<typeof deriveApiHealth>[2]> = {}) {
  return {
    createdAt: new Date(NOW - 60_000).toISOString(),
    status: 'success' as const,
    rateLimited: false,
    errors: [],
    durationMs: 1200,
    releasesSynced: 3,
    artistsProcessed: 2,
    concertsSynced: null,
    ...overrides,
  }
}

describe('formatDurationMs', () => {
  it('formats sub-second and second durations', () => {
    expect(formatDurationMs(450)).toBe('450ms')
    expect(formatDurationMs(1500)).toBe('1.5s')
  })
})

describe('deriveApiHealth', () => {
  it('reports unconfigured APIs with API Keys hint', () => {
    const result = deriveApiHealth('spotify', false, null, NOW)
    expect(result.operationalState).toBe('unconfigured')
    expect(result.statusLabel).toBe('Not configured')
    expect(result.statusDetail).toContain('Admin → API Keys')
  })

  it('describes per-artist Bandsintown configuration', () => {
    const result = deriveApiHealth('bandsintown', false, null, NOW)
    expect(result.statusDetail).toContain('Per-artist')
  })

  it('reports idle when configured but never synced', () => {
    const result = deriveApiHealth('itunes', true, null, NOW)
    expect(result.operationalState).toBe('idle')
    expect(result.statusLabel).toBe('Awaiting first sync')
  })

  it('reports operational on recent success', () => {
    const result = deriveApiHealth('spotify', true, makeSnapshot(), NOW)
    expect(result.operationalState).toBe('operational')
    expect(result.statusDetail).toContain('3 releases')
    expect(result.statusDetail).toContain('1.2s')
  })

  it('reports failing on error status', () => {
    const result = deriveApiHealth(
      'discogs',
      true,
      makeSnapshot({ status: 'error', errors: ['timeout'] }),
      NOW,
    )
    expect(result.operationalState).toBe('failing')
    expect(result.statusLabel).toBe('Last run failed')
  })

  it('reports stale when last success is too old', () => {
    const result = deriveApiHealth(
      'itunes',
      true,
      makeSnapshot({ createdAt: new Date(NOW - STALE_SYNC_MS - 1000).toISOString() }),
      NOW,
    )
    expect(result.operationalState).toBe('stale')
    expect(result.statusLabel).toBe('Sync overdue')
  })
})

describe('deriveSyncQueueHealth', () => {
  it('flags stuck running jobs as failing', () => {
    const result = deriveSyncQueueHealth({
      pending: 0,
      running: 2,
      done: 10,
      failed: 0,
      stuckRunning: 1,
    })
    expect(result.operationalState).toBe('failing')
    expect(result.statusLabel).toBe('Stuck jobs detected')
  })

  it('reports processing when jobs are active', () => {
    const result = deriveSyncQueueHealth({
      pending: 5,
      running: 1,
      done: 20,
      failed: 0,
      stuckRunning: 0,
    })
    expect(result.operationalState).toBe('operational')
    expect(result.statusLabel).toBe('Processing')
  })
})

describe('deriveOverallHealth', () => {
  it('returns unhealthy when database is offline', () => {
    const result = deriveOverallHealth(false, ['operational'], 'operational')
    expect(result.status).toBe('unhealthy')
    expect(result.statusLabel).toBe('Database unreachable')
  })

  it('returns degraded when APIs are stale', () => {
    const result = deriveOverallHealth(true, ['operational', 'stale'], 'operational')
    expect(result.status).toBe('degraded')
  })
})

describe('parseSyncLogSnapshot', () => {
  it('extracts metrics from metadata', () => {
    const snapshot = parseSyncLogSnapshot({
      created_at: '2026-06-23T10:00:00Z',
      status: 'success',
      rate_limited: false,
      errors: [],
      duration_ms: 800,
      releases_synced: 4,
      metadata: { artists_processed: 3, concerts_synced: 12 },
    })
    expect(snapshot.artistsProcessed).toBe(3)
    expect(snapshot.concertsSynced).toBe(12)
  })
})

describe('sortApiSources', () => {
  it('orders known APIs before unknown sources', () => {
    expect(sortApiSources(['youtube', 'lastfm', 'itunes', 'custom'])).toEqual([
      'itunes',
      'lastfm',
      'youtube',
      'custom',
    ])
  })
})