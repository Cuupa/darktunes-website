import { describe, expect, it } from 'vitest'
import {
  ownerPercentagesSumTo100,
  resolveAssignmentOwners,
  splitPreservesTotal,
  splitRevenueAmongOwners,
  sumOwnerPercentages,
} from './trackAssignmentSplits'
import type { TrackRevenueAssignment } from './types'

function buildAssignment(percentages: number[]): TrackRevenueAssignment {
  return {
    id: 'test',
    trackTitle: 'Track',
    owners: percentages.map((percentage, index) => ({
      artist: `Artist ${index + 1}`,
      percentage,
    })),
  }
}

describe('trackAssignmentSplits', () => {
  it('accepts percentages that sum to 100', () => {
    const owners = [{ percentage: 60 }, { percentage: 40 }]
    expect(ownerPercentagesSumTo100(owners)).toBe(true)
    expect(sumOwnerPercentages(owners)).toBe(100)
  })

  it('rejects percentages that do not sum to 100', () => {
    expect(ownerPercentagesSumTo100([{ percentage: 50 }, { percentage: 40 }])).toBe(false)
  })

  it('drops zero-percentage co-owners and preserves revenue total', () => {
    const assignment = buildAssignment([100, 0, 0])
    const owners = resolveAssignmentOwners(assignment)
    expect(owners).toHaveLength(1)
    expect(owners[0]?.fraction).toBe(1)

    for (const total of [0, 12.34, 999.99, 1_000_000.12]) {
      expect(splitPreservesTotal(total, owners)).toBe(true)
    }
  })

  it('preserves revenue total across many valid split combinations', () => {
    const cases = [
      [100],
      [50, 50],
      [33.33, 33.33, 33.34],
      [70, 20, 10],
      [12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5],
    ]

    for (const percentages of cases) {
      expect(ownerPercentagesSumTo100(percentages.map((p) => ({ percentage: p })))).toBe(true)
      const owners = resolveAssignmentOwners(buildAssignment(percentages))
      expect(splitPreservesTotal(482.17, owners)).toBe(true)
      const split = splitRevenueAmongOwners(482.17, owners)
      const sum = [...split.values()].reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(482.17, 4)
    }
  })

  it('falls back to legacy ownerArtist at 100%', () => {
    const assignment: TrackRevenueAssignment = {
      id: 'legacy',
      trackTitle: 'EP',
      ownerArtist: 'Solo Act',
    }
    const owners = resolveAssignmentOwners(assignment)
    expect(owners).toEqual([{ artist: 'Solo Act', fraction: 1 }])
  })
})