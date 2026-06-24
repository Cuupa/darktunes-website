import { describe, expect, it, vi, beforeEach } from 'vitest'
import { computeEventImpactForArtist } from './eventImpact'

vi.mock('@/lib/api/concerts', () => ({
  getConcertsByArtistId: vi.fn(),
}))

vi.mock('@/lib/api/artistTerritoryMetrics', () => ({
  getTerritoryMetricsByArtistId: vi.fn(),
}))

vi.mock('@/lib/api/eventImpact', () => ({
  upsertEventImpactRows: vi.fn(async (rows: unknown[]) => rows.length),
}))

import { getConcertsByArtistId } from '@/lib/api/concerts'
import { getTerritoryMetricsByArtistId } from '@/lib/api/artistTerritoryMetrics'

describe('computeEventImpactForArtist', () => {
  beforeEach(() => {
    vi.mocked(getConcertsByArtistId).mockReset()
    vi.mocked(getTerritoryMetricsByArtistId).mockReset()
  })

  it('returns 0 when no concerts or metrics', async () => {
    vi.mocked(getConcertsByArtistId).mockResolvedValue([])
    vi.mocked(getTerritoryMetricsByArtistId).mockResolvedValue([])

    const count = await computeEventImpactForArtist({} as never, 'artist-1')
    expect(count).toBe(0)
  })
})