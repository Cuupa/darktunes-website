import { describe, expect, it } from 'vitest'
import { computeSnapPosition } from './snapGuides'

describe('computeSnapPosition', () => {
  it('snaps to page center when close enough', () => {
    const result = computeSnapPosition(
      { x: 398, y: 100, width: 100, height: 40 },
      {
        snapEnabled: true,
        gridSize: 16,
        pageWidth: 800,
        pageHeight: 600,
        others: [],
        threshold: 8,
      },
    )

    expect(result.x).toBe(400)
    expect(result.guides.vertical).toContain(400)
  })

  it('snaps to another element edge', () => {
    const result = computeSnapPosition(
      { x: 108, y: 50, width: 100, height: 40 },
      {
        snapEnabled: true,
        gridSize: 16,
        pageWidth: 800,
        pageHeight: 600,
        others: [{ x: 0, y: 50, width: 100, height: 40 }],
        threshold: 8,
      },
    )

    expect(result.x).toBe(100)
    expect(result.guides.vertical).toContain(100)
  })
})