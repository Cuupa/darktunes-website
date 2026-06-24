import { describe, expect, it, vi } from 'vitest'
import { persistAnalyticsAfterStatementUpload } from './persistAfterStatementUpload'

vi.mock('@/lib/sos/persistSosAnalyticsAction', () => ({
  persistSosAnalytics: vi.fn(async () => ({ success: true, merchOrdersUpserted: 2 })),
}))

import { persistSosAnalytics } from '@/lib/sos/persistSosAnalyticsAction'

describe('persistAnalyticsAfterStatementUpload', () => {
  it('passes filtered merch rows for the published artist', async () => {
    await persistAnalyticsAfterStatementUpload({
      artistName: 'Band A',
      periodStart: '2024-01',
      periodEnd: '2024-01',
      territoryMetrics: [{
        artistName: 'Band A',
        period: '2024-01',
        platform: 'Spotify',
        country: 'DE',
        streams: 10,
        revenueEur: 1,
        quantity: 0,
      }],
      merchOrderRows: [
        {
          externalId: 'm1',
          artistName: 'Band A',
          source: 'shopify',
          period: '2024-01',
          productTitle: 'Shirt',
          country: 'DE',
          quantity: 1,
          revenueEur: 25,
        },
        {
          externalId: 'm2',
          artistName: 'Band B',
          source: 'shopify',
          period: '2024-01',
          productTitle: 'Hoodie',
          country: 'DE',
          quantity: 1,
          revenueEur: 40,
        },
      ],
      labelArtists: [{ id: '1', name: 'Band A', artistId: 'artist-1' }],
      revenues: [],
      bronzeBatchIds: [],
    })

    expect(persistSosAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        merchOrderRows: [expect.objectContaining({ externalId: 'm1', artistName: 'Band A' })],
      }),
    )
  })

  it('skips persist when the artist has no territory metrics', async () => {
    vi.mocked(persistSosAnalytics).mockClear()

    await persistAnalyticsAfterStatementUpload({
      artistName: 'Unknown',
      periodStart: '2024-01',
      periodEnd: '2024-01',
      territoryMetrics: [{
        artistName: 'Band A',
        period: '2024-01',
        platform: 'Spotify',
        country: 'DE',
        streams: 10,
        revenueEur: 1,
        quantity: 0,
      }],
      merchOrderRows: [],
      labelArtists: [],
      revenues: [],
      bronzeBatchIds: [],
    })

    expect(persistSosAnalytics).not.toHaveBeenCalled()
  })
})