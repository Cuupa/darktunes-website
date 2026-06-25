import type { TrackRevenueAssignment } from '@/lib/sos/types'

export interface AssignmentOwnerFraction {
  artist: string
  fraction: number
}

const PERCENT_SUM_TOLERANCE = 0.001
const REVENUE_SPLIT_TOLERANCE = 0.0001

export function sumOwnerPercentages(owners: ReadonlyArray<{ percentage: number }>): number {
  return owners.reduce((sum, owner) => sum + owner.percentage, 0)
}

export function ownerPercentagesSumTo100(owners: ReadonlyArray<{ percentage: number }>): boolean {
  if (owners.length === 0) return false
  return Math.abs(sumOwnerPercentages(owners) - 100) <= PERCENT_SUM_TOLERANCE
}

/**
 * Resolves active owners with fractional shares (0–1). Drops zero-% and empty names.
 */
export function resolveAssignmentOwners(
  assignment: TrackRevenueAssignment,
): ReadonlyArray<AssignmentOwnerFraction> {
  if (assignment.owners && assignment.owners.length > 0) {
    return assignment.owners
      .filter((o) => o.percentage > 0 && o.artist.trim() !== '')
      .map((o) => ({
        artist: o.artist,
        fraction: o.percentage / 100,
      }))
  }
  const legacyArtist = assignment.ownerArtist ?? ''
  if (!legacyArtist.trim()) return []
  return [{ artist: legacyArtist, fraction: 1 }]
}

/**
 * Splits a revenue amount across owners. Returns per-artist amounts that sum to total.
 */
export function splitRevenueAmongOwners(
  totalRevenue: number,
  owners: ReadonlyArray<AssignmentOwnerFraction>,
): Map<string, number> {
  const result = new Map<string, number>()
  if (owners.length === 0 || totalRevenue === 0) return result

  let allocated = 0
  for (let i = 0; i < owners.length; i++) {
    const owner = owners[i]
    if (!owner) continue
    const isLast = i === owners.length - 1
    const share = isLast
      ? totalRevenue - allocated
      : totalRevenue * owner.fraction
    allocated += share
    const key = owner.artist.trim()
    result.set(key, (result.get(key) ?? 0) + share)
  }
  return result
}

export function splitPreservesTotal(
  totalRevenue: number,
  owners: ReadonlyArray<AssignmentOwnerFraction>,
): boolean {
  const split = splitRevenueAmongOwners(totalRevenue, owners)
  const sum = [...split.values()].reduce((a, b) => a + b, 0)
  return Math.abs(sum - totalRevenue) <= REVENUE_SPLIT_TOLERANCE
}