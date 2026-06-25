/**
 * SOS royalty data processor — splits transactions into per-artist payouts,
 * breakdowns, and territory metrics.
 */

export type {
  DataProcessorConfig,
  ProcessedArtistData,
  ProcessorResult,
  TerritoryMetricRow,
} from './types'

export {
  isCompilation,
  resolveMainArtist,
  extractCollabs,
  getUniqueArtistsFromTransactions,
} from './distribution'

export {
  clampSplitPercentage,
  resolveDistributionFeeRate,
  resolveSplitPercentage,
  resolveSplitPercentageWithSourceOverride,
  buildProcessedArtistData,
} from './fees'

export {
  buildPlatformBreakdown,
  buildCountryBreakdown,
  buildMonthlyBreakdown,
  buildReleaseBreakdown,
  buildArtistTree,
} from './breakdowns'

export { aggregateTerritoryMetrics } from './territory'

export { processTransactions, processTransactionsWithCompilations } from './pipeline'