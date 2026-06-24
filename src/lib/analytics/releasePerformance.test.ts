import { describe, it, expect } from 'vitest'
import { aggregateReleasePerformance } from './releasePerformance'

describe('aggregateReleasePerformance', () => {
  it('sums line items per release', () => {
    const rows = aggregateReleasePerformance([
      {
        id: '1',
        statementId: 's1',
        releaseId: 'r1',
        platform: 'Spotify',
        country: 'DE',
        streams: 100,
        revenueEur: 5,
        quantity: 0,
        createdAt: '2025-01-01',
        periodStart: '2025-01-01',
        periodEnd: '2025-01-31',
        releaseTitle: 'Album A',
        releaseIsrc: 'DEXX1',
      },
      {
        id: '2',
        statementId: 's1',
        releaseId: 'r1',
        platform: 'Apple',
        country: 'DE',
        streams: 50,
        revenueEur: 3,
        quantity: 0,
        createdAt: '2025-01-01',
        periodStart: '2025-01-01',
        periodEnd: '2025-01-31',
        releaseTitle: 'Album A',
        releaseIsrc: 'DEXX1',
      },
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]!.totalStreams).toBe(150)
    expect(rows[0]!.totalRevenueEur).toBe(8)
    expect(rows[0]!.releaseTitle).toBe('Album A')
  })
})