/**
 * Release-level performance aggregation from SOS line items.
 */

import type { ArtistLineItemWithContext } from '@/lib/api/salesStatementLineItems'

export interface ReleasePerformanceRow {
  releaseId: string | undefined
  releaseTitle: string
  releaseIsrc: string | undefined
  totalStreams: number
  totalRevenueEur: number
  totalQuantity: number
  lineItemCount: number
}

const UNATTRIBUTED_KEY = '__unattributed__'

export function aggregateReleasePerformance(
  lineItems: ArtistLineItemWithContext[],
): ReleasePerformanceRow[] {
  const bucket = new Map<string, ReleasePerformanceRow>()

  for (const item of lineItems) {
    const key = item.releaseId ?? UNATTRIBUTED_KEY
    const existing = bucket.get(key) ?? {
      releaseId: item.releaseId,
      releaseTitle: item.releaseTitle ?? (item.releaseId ? 'Unknown release' : 'Unattributed'),
      releaseIsrc: item.releaseIsrc,
      totalStreams: 0,
      totalRevenueEur: 0,
      totalQuantity: 0,
      lineItemCount: 0,
    }

    if (item.releaseTitle && existing.releaseTitle === 'Unknown release') {
      existing.releaseTitle = item.releaseTitle
    }
    if (item.releaseIsrc && !existing.releaseIsrc) {
      existing.releaseIsrc = item.releaseIsrc
    }

    existing.totalStreams += item.streams
    existing.totalRevenueEur += item.revenueEur
    existing.totalQuantity += item.quantity
    existing.lineItemCount += 1
    bucket.set(key, existing)
  }

  return [...bucket.values()].sort((a, b) => b.totalRevenueEur - a.totalRevenueEur)
}