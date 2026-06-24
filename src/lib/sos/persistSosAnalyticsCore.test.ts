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

vi.mock('@/lib/analytics/promoImpactCompute', () => ({
  computePromoImpactForArtist: vi.fn(async () => 2),
}))

vi.mock('@/lib/api/merchOrders', () => ({
  upsertMerchOrders: vi.fn(async (_db: unknown, rows: unknown[]) => rows.length),
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
    expect(result.promoImpactRows).toBe(2)
  })

  it('upserts merch orders when provided', async () => {
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
      merchOrderRows: [{
        externalId: 'm1',
        artistName: 'Band A',
        source: 'shopify',
        period: '2024-01',
        productTitle: 'Shirt',
        country: 'DE',
        quantity: 1,
        revenueEur: 25,
      }],
      labelArtists: [{ name: 'Band A', artistId: 'artist-1' }],
    })

    expect(result.success).toBe(true)
    expect(result.merchOrdersUpserted).toBe(1)
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