import { describe, it, expect } from 'vitest'
import { aggregateTerritoryMetrics } from './data-processor'
import type { ProcessedArtistData } from './data-processor'
import type { SalesTransaction } from './ingest/csv-parser'

function makeTx(overrides: Partial<SalesTransaction>): SalesTransaction {
  return {
    id: 'tx-1',
    source: 'believe',
    sales_month: '2024-03',
    platform: 'Spotify',
    country: 'Germany',
    main_artist: 'Test Artist',
    original_artist: 'Test Artist',
    release_title: 'Album',
    track_title: 'Track',
    upc_ean: '',
    isrc: '',
    catalog_number: '',
    quantity: 100,
    net_revenue: 1.5,
    currency: 'EUR',
    is_physical: false,
    is_download: false,
    ...overrides,
  }
}

describe('aggregateTerritoryMetrics', () => {
  it('aggregates streams and revenue by artist, period, platform, and country', () => {
    const artistData: Pick<ProcessedArtistData, 'artist' | 'transactions'>[] = [
      {
        artist: 'Neuroklast',
        transactions: [
          makeTx({ id: 'a', quantity: 100, net_revenue: 2 }),
          makeTx({ id: 'b', quantity: 50, net_revenue: 1 }),
          makeTx({ id: 'c', country: 'Poland', quantity: 30, net_revenue: 0.5 }),
        ],
      },
    ]

    const result = aggregateTerritoryMetrics(artistData)
    expect(result).toHaveLength(2)

    const de = result.find((r) => r.country === 'Germany')
    expect(de).toMatchObject({
      artistName: 'Neuroklast',
      period: '2024-03',
      platform: 'Spotify',
      streams: 150,
      revenueEur: 3,
      quantity: 150,
    })
  })

  it('skips rows without country or invalid period', () => {
    const artistData: Pick<ProcessedArtistData, 'artist' | 'transactions'>[] = [
      {
        artist: 'Neuroklast',
        transactions: [
          makeTx({ country: '', sales_month: '2024-03' }),
          makeTx({ country: 'DE', sales_month: 'Unknown' }),
        ],
      },
    ]

    expect(aggregateTerritoryMetrics(artistData)).toHaveLength(0)
  })
})