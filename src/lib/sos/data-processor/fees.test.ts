import { describe, expect, it } from 'vitest'
import {
  buildProcessedArtistData,
  clampSplitPercentage,
  resolveDistributionFeeRate,
  resolveSplitPercentage,
  resolveSplitPercentageWithSourceOverride,
} from './fees'
import type { DataProcessorConfig } from './types'
import type { SalesTransaction } from '../ingest/csv-parser'

function makeTx(overrides: Partial<SalesTransaction>): SalesTransaction {
  return {
    id: 'tx-1',
    source: 'believe',
    sales_month: '2024-03',
    platform: 'Spotify',
    country: 'Germany',
    main_artist: 'Neuroklast',
    original_artist: 'Neuroklast',
    release_title: 'Album',
    track_title: 'Track',
    upc_ean: '',
    isrc: '',
    catalog_number: '',
    quantity: 100,
    net_revenue: 10,
    currency: 'EUR',
    is_physical: false,
    is_download: false,
    ...overrides,
  }
}

const baseConfig = (): DataProcessorConfig => ({
  compilationFilters: [],
  artistMappings: [],
  splitFees: [],
  manualRevenues: [],
  expenses: [],
  distributionFeePercentage: 10,
  distributionFeeDigital: 10,
  distributionFeePhysical: 5,
})

describe('split resolution helpers', () => {
  it('clampSplitPercentage constrains to 0–100', () => {
    expect(clampSplitPercentage(-5)).toBe(0)
    expect(clampSplitPercentage(150)).toBe(100)
    expect(clampSplitPercentage(50)).toBe(50)
  })

  it('resolveSplitPercentage prefers per-artist digital override', () => {
    expect(
      resolveSplitPercentage({ percentage: 50, digitalPercentage: 70 }, 'digital'),
    ).toBe(70)
    expect(
      resolveSplitPercentage({ percentage: 50, physicalPercentage: 40 }, 'physical'),
    ).toBe(40)
  })

  it('resolveSplitPercentageWithSourceOverride honours sourceOverrides', () => {
    const splitFee = {
      artist: 'Neuroklast',
      percentage: 50,
      sourceOverrides: [{ source: 'believe' as const, percentage: 80 }],
    }
    expect(
      resolveSplitPercentageWithSourceOverride(splitFee, 'believe', false, 100),
    ).toBe(80)
    expect(
      resolveSplitPercentageWithSourceOverride(splitFee, 'bandcamp', false, 100),
    ).toBe(50)
  })

  it('resolveDistributionFeeRate uses override when set', () => {
    expect(resolveDistributionFeeRate(15, 10)).toBeCloseTo(0.15)
    expect(resolveDistributionFeeRate(undefined, 10)).toBeCloseTo(0.1)
  })
})

describe('buildProcessedArtistData', () => {
  it('applies separate digital and physical distribution fees', () => {
    const result = buildProcessedArtistData({
      lowerKey: 'neuroklast',
      artist: 'Neuroklast',
      artistTransactions: [
        makeTx({ id: 'd', net_revenue: 100, is_physical: false }),
        makeTx({ id: 'p', net_revenue: 100, is_physical: true }),
      ],
      config: {
        ...baseConfig(),
        splitFees: [{ artist: 'Neuroklast', percentage: 100 }],
      },
    })

    expect(result.distributionFeeDeducted).toBeCloseTo(15, 2)
    expect(result.finalPayout).toBeCloseTo(185, 2)
  })

  it('applies per-source believe bucket split', () => {
    const result = buildProcessedArtistData({
      lowerKey: 'neuroklast',
      artist: 'Neuroklast',
      artistTransactions: [makeTx({ net_revenue: 100, source: 'believe' })],
      config: {
        ...baseConfig(),
        sourceSplits: { believe: 70 },
        distributionFeePercentage: 0,
        distributionFeeDigital: 0,
        distributionFeePhysical: 0,
      },
    })

    expect(result.believeSplitPercentage).toBe(70)
    expect(result.finalPayout).toBeCloseTo(70, 2)
  })
})