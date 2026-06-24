import { describe, expect, it } from 'vitest'
import {
  computeAnalyticsInsights,
  computeAnalyticsKpis,
  matchesQuickSearch,
} from './insights'
import type { StreamingStat } from '@/lib/api/streamingStats'
import type { ArtistTerritoryMetric } from '@/lib/api/artistTerritoryMetrics'


const stat = (period: string, streams: number, platform = 'Spotify'): StreamingStat => ({
  id: period,
  artistId: 'a1',
  platform,
  period,
  streams,
  createdAt: '2024-01-01',
})

const metric = (period: string, revenue: number, country = 'DE'): ArtistTerritoryMetric => ({
  id: period,
  artistId: 'a1',
  period,
  platform: 'Spotify',
  country,
  streams: 100,
  revenueEur: revenue,
  quantity: 0,
  sourceBatchId: undefined,
  updatedAt: '2024-01-01',
})

describe('computeAnalyticsKpis', () => {
  it('aggregates streams, revenue, and growth', () => {
    const kpis = computeAnalyticsKpis({
      stats: [stat('2024-01', 100), stat('2024-02', 200)],
      territoryMetrics: [metric('2024-01', 10), metric('2024-02', 20)],
      listenerMetrics: [],
      statements: [],
    })
    expect(kpis.totalStreams).toBe(300)
    expect(kpis.totalRevenueEur).toBe(30)
    expect(kpis.streamGrowthPct).toBe(100)
    expect(kpis.revenueGrowthPct).toBe(100)
    expect(kpis.topPlatform).toBe('Spotify')
    expect(kpis.topCountry).toBe('DE')
  })
})

describe('computeAnalyticsInsights', () => {
  it('detects upward trend with enough periods', () => {
    const insights = computeAnalyticsInsights({
      stats: [stat('2024-01', 100), stat('2024-02', 150), stat('2024-03', 200)],
      territoryMetrics: [],
      listenerMetrics: [],
      eventImpacts: [],
    })
    expect(insights.some((i) => i.id === 'trend-up')).toBe(true)
  })
})

describe('matchesQuickSearch', () => {
  it('matches case-insensitive substrings', () => {
    expect(matchesQuickSearch('spot', 'Spotify', '2024-01')).toBe(true)
    expect(matchesQuickSearch('apple', 'Spotify')).toBe(false)
    expect(matchesQuickSearch('', 'anything')).toBe(true)
  })
})