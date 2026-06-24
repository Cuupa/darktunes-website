import { describe, it, expect } from 'vitest'
import { aggregatePressEngagement } from './pressEngagement'

describe('aggregatePressEngagement', () => {
  it('aggregates download stats', () => {
    const summary = aggregatePressEngagement([
      {
        id: '1',
        journalistId: 'j1',
        releaseId: 'r1',
        assetKey: 'photo.jpg',
        downloadedAt: new Date().toISOString(),
      },
      {
        id: '2',
        journalistId: 'j2',
        releaseId: 'r1',
        assetKey: 'photo.jpg',
        downloadedAt: new Date().toISOString(),
      },
    ])

    expect(summary.totalDownloads).toBe(2)
    expect(summary.uniqueJournalists).toBe(2)
    expect(summary.topAssetKeys[0]!.assetKey).toBe('photo.jpg')
  })
})