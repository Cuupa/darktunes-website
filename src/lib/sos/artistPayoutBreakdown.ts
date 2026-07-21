import type { ArtistRevenue } from '@/lib/sos/types'

/**
 * Residual "other digital" revenue for SOS admin breakdown UI.
 * Believe and Bandcamp are listed separately; this is only the remainder.
 *
 * Algebra: total − physical − believe − bandcamp − darkmerch
 * (manualRevenue is displayed separately and is assumed outside this residual).
 */
export function computeOtherDigitalRevenue(revenue: ArtistRevenue): number {
  return Math.max(
    0,
    revenue.totalRevenue -
      revenue.physicalReleasesRevenue -
      revenue.believeRevenue -
      revenue.bandcampRevenue -
      revenue.darkmerchRevenue,
  )
}
