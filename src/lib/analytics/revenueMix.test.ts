import { describe, it, expect } from 'vitest'
import { categorizeTerritoryMetric, computeRevenueMix } from './revenueMix'
import type { ArtistTerritoryMetric } from '@/lib/api/artistTerritoryMetrics'

function metric(overrides: Partial<ArtistTerritoryMetric>): ArtistTerritoryMetric {
  return {
    id: '1',
    artistId: 'a1',
    period: '2025-01',
    platform: 'Spotify',
    country: 'DE',
    streams: 1000,
    revenueEur: 10,
    quantity: 0,
    sourceBatchId: undefined,
    updatedAt: '2025-01-01',
    ...overrides,
  }
}

describe('revenueMix', () => {
  it('categorizes merch platforms', () => {
    expect(categorizeTerritoryMetric(metric({ platform: 'darkmerch', streams: 0 }))).toBe('merch')
  })

  it('categorizes bandcamp as direct', () => {
    expect(categorizeTerritoryMetric(metric({ platform: 'Bandcamp' }))).toBe('direct')
  })

  it('aggregates revenue by category', () => {
    const slices = computeRevenueMix([
      metric({ platform: 'Spotify', revenueEur: 50, streams: 500 }),
      metric({ platform: 'Bandcamp', revenueEur: 20, streams: 0 }),
      metric({ platform: 'darkmerch', revenueEur: 30, streams: 0, quantity: 2 }),
    ])
    const digital = slices.find((s) => s.category === 'digital')
    const direct = slices.find((s) => s.category === 'direct')
    const merch = slices.find((s) => s.category === 'merch')
    expect(digital?.revenueEur).toBe(50)
    expect(direct?.revenueEur).toBe(20)
    expect(merch?.revenueEur).toBe(30)
  })
})