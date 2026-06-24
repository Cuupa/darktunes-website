import { describe, expect, it, vi } from 'vitest'
import { persistSosAnalyticsCore } from './persistSosAnalyticsCore'

vi.mock('@/lib/api/artistTerritoryMetrics', () => ({
  upsertTerritoryMetrics: vi.fn(async () => 2),
}))

vi.mock('@/lib/api/streamingStats', () => ({
  upsertStreamingStats: vi.fn(async () => undefined),
}))

vi.mock('@/lib/api/distributorImportBatches', () => ({
  updateImportBatchStatus: vi.fn(async () => undefined),
}))

vi.mock('@/lib/api/sosPeriodSummaries', () => ({
  upsertSosPeriodSummary: vi.fn(async () => undefined),
}))

vi.mock('@/lib/analytics/eventImpact', () => ({
  computeEventImpactForArtist: vi.fn(async () => 3),
}))

describe('persistSosAnalyticsCore', () => {
  it('returns event impact row count on success', async () => {
    const result = await persistSosAnalyticsCore({} as never, {
      periodStart: '2024-01',
      periodEnd: '2024-01',
      territoryMetrics: [{
        artistName: 'Band A',
        period: '2024-01',
        platform: 'Spotify',
        country: 'DE',
        streams: 100,
        revenueEur: 10,
        quantity: 0,
      }],
      labelArtists: [{ name: 'Band A', artistId: 'artist-1' }],
    })

    expect(result.success).toBe(true)
    expect(result.metricsUpserted).toBe(2)
    expect(result.eventImpactRows).toBe(3)
  })

  it('fails when no metrics match linked artists', async () => {
    const result = await persistSosAnalyticsCore({} as never, {
      periodStart: '2024-01',
      periodEnd: '2024-01',
      territoryMetrics: [{
        artistName: 'Unknown',
        period: '2024-01',
        platform: 'Spotify',
        country: 'DE',
        streams: 1,
        revenueEur: 1,
        quantity: 0,
      }],
      labelArtists: [{ name: 'Band A', artistId: 'artist-1' }],
    })

    expect(result.success).toBe(false)
  })
})