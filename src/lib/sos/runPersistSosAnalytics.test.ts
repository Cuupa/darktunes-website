import { describe, expect, it, vi } from 'vitest'
import type { ArtistRevenue } from '@/lib/sos/types'
import { runPersistSosAnalytics } from './runPersistSosAnalytics'

vi.mock('@/lib/sos/persistSosAnalyticsAction', () => ({
  persistSosAnalytics: vi.fn(async () => ({ success: true, metricsUpserted: 3 })),
}))

import { persistSosAnalytics } from '@/lib/sos/persistSosAnalyticsAction'

describe('runPersistSosAnalytics', () => {
  it('builds period summary from revenues and delegates to persistSosAnalytics', async () => {
    const result = await runPersistSosAnalytics({
      periodStart: '2026-01',
      periodEnd: '2026-03',
      territoryMetrics: [
        {
          artistName: 'Artist A',
          period: '2026-01',
          platform: 'Spotify',
          country: 'DE',
          streams: 100,
          revenueEur: 12.5,
          quantity: 0,
        },
      ],
      labelArtists: [{ id: 'a1', name: 'Artist A', artistId: 'a1' }],
      revenues: [
        {
          artist: 'Artist A',
          totalRevenue: 100,
          finalAmount: 70,
          platformBreakdown: [{ platform: 'Spotify', revenue: 100, quantity: 0 }],
        } as ArtistRevenue,
      ],
      bronzeBatchIds: ['batch-1'],
    })

    expect(result.success).toBe(true)
    expect(persistSosAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        periodStart: '2026-01',
        periodEnd: '2026-03',
        batchIds: ['batch-1'],
        periodSummary: expect.objectContaining({
          totalRevenue: 100,
          totalPayout: 70,
          artistCount: 1,
          sourceBatchIds: ['batch-1'],
        }),
      }),
    )
  })
})