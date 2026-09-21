import { findByArtistName, normalizeArtistNameKey } from '@/lib/sos/artistNameKey'
import type { AppDefaults, ArtistRevenue, SplitFee } from '@/lib/sos/types'

export type SplitOriginId =
  | 'artist-source'
  | 'global-source'
  | 'artist-digital'
  | 'artist-physical'
  | 'default-digital'
  | 'default-physical'
  | 'artist'
  | 'default'

export interface SplitOrigin {
  percent: number
  origin: SplitOriginId
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value))
}

/**
 * Explains Believe/Bandcamp/physical/Darkmerch split origin using the same
 * bucket chain as `buildProcessedArtistData` — not the helper that prefers
 * artist digital % over global source splits.
 */
export function explainAppliedSplits(
  artist: string,
  splitFees: SplitFee[],
  defaults: Pick<
    AppDefaults,
    | 'defaultSplitPercentage'
    | 'defaultSplitPercentageDigital'
    | 'defaultSplitPercentagePhysical'
    | 'sourceSplits'
  >,
): {
  believe: SplitOrigin
  bandcamp: SplitOrigin
  physical: SplitOrigin
  darkmerch: SplitOrigin
} {
  const splitFee = findByArtistName(splitFees, normalizeArtistNameKey(artist))
  const defaultBase = defaults.defaultSplitPercentage ?? 100
  const sourceSplits = defaults.sourceSplits

  const mainChain = (): SplitOrigin => {
    if (splitFee?.digitalPercentage != null) {
      return { percent: clamp(splitFee.digitalPercentage), origin: 'artist-digital' }
    }
    if (defaults.defaultSplitPercentageDigital != null) {
      return { percent: clamp(defaults.defaultSplitPercentageDigital), origin: 'default-digital' }
    }
    if (splitFee != null) {
      return { percent: clamp(splitFee.percentage), origin: 'artist' }
    }
    return { percent: clamp(defaultBase), origin: 'default' }
  }

  const digitalFallback = mainChain()

  const bucket = (
    source: 'believe' | 'bandcamp',
    global: number | undefined,
  ): SplitOrigin => {
    const artistSource = splitFee?.sourceOverrides?.find((o) => o.source === source)
    if (artistSource != null) {
      return { percent: clamp(artistSource.percentage), origin: 'artist-source' }
    }
    if (global != null) {
      return { percent: clamp(global), origin: 'global-source' }
    }
    return digitalFallback
  }

  const believe = bucket('believe', sourceSplits?.believe)
  const bandcamp = bucket('bandcamp', sourceSplits?.bandcamp)

  const physicalArtistSource = splitFee?.sourceOverrides?.find(
    (o) => o.source === 'shopify' || o.source === 'printful',
  )
  let physical: SplitOrigin
  if (physicalArtistSource != null) {
    physical = { percent: clamp(physicalArtistSource.percentage), origin: 'artist-source' }
  } else if (splitFee?.physicalPercentage != null) {
    physical = { percent: clamp(splitFee.physicalPercentage), origin: 'artist-physical' }
  } else if (sourceSplits?.physical != null) {
    physical = { percent: clamp(sourceSplits.physical), origin: 'global-source' }
  } else if (defaults.defaultSplitPercentagePhysical != null) {
    physical = { percent: clamp(defaults.defaultSplitPercentagePhysical), origin: 'default-physical' }
  } else if (splitFee != null) {
    physical = { percent: clamp(splitFee.percentage), origin: 'artist' }
  } else {
    physical = { percent: clamp(defaultBase), origin: 'default' }
  }

  const darkmerchArtist = splitFee?.sourceOverrides?.find((o) => o.source === 'darkmerch')
  let darkmerch: SplitOrigin
  if (sourceSplits?.darkmerch != null) {
    darkmerch = {
      percent: clamp(darkmerchArtist?.percentage ?? sourceSplits.darkmerch),
      origin: darkmerchArtist != null ? 'artist-source' : 'global-source',
    }
  } else if (darkmerchArtist != null) {
    darkmerch = { percent: clamp(darkmerchArtist.percentage), origin: 'artist-source' }
  } else {
    darkmerch = physical
  }

  return { believe, bandcamp, physical, darkmerch }
}

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
