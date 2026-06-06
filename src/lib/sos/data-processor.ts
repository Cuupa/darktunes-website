import type { SalesTransaction } from './ingest/csv-parser'
import type {
  CompilationFilter,
  ArtistMapping,
  SplitFee,
  ManualRevenue,
  ExpenseEntry,
  PlatformRevenue,
  CountryRevenue,
  MonthlyRevenue,
  ReleaseRevenue,
  FilteredCompilation,
  LabelArtist,
  IgnoredEntry,
  ReleaseSplitOverride,
  TransactionSource,
  TrackRevenueAssignment,
} from './types'
import { convertToEur } from './currency'
import type { ExchangeRates, HistoricalRates } from './currency'

export interface ProcessedArtistData {
  artist: string
  transactions: SalesTransaction[]
  /** EUR-normalised revenue from Believe-sourced rows. */
  believeRevenue: number
  /** EUR-normalised revenue from Bandcamp-sourced rows. */
  bandcampRevenue: number
  /** EUR-normalised revenue from Darkmerch-sourced rows. */
  darkmerchRevenue: number
  totalDigitalRevenue: number
  totalPhysicalRevenue: number
  /** Revenue from digital download transactions (subset of totalDigitalRevenue). */
  totalDownloadRevenue: number
  /** Revenue from streaming transactions (subset of totalDigitalRevenue). */
  totalStreamRevenue: number
  manualRevenue: number
  /** Individual manual revenue entries with description and amount. */
  manualRevenueEntries: Array<{ description: string; amount: number }>
  grossRevenue: number
  splitPercentage: number
  finalPayout: number
  totalQuantity: number
  /** Total recoupable expenses deducted from artist payout after split. */
  totalExpenses: number
  /** Individual expense entries that make up totalExpenses. */
  expenseEntries: Array<{ description: string; amount: number; date: string }>
  /** Label distribution fee (EUR) deducted from streaming/physical revenue before the split. */
  distributionFeeDeducted: number
  platformBreakdown: PlatformRevenue[]
  countryBreakdown: CountryRevenue[]
  monthlyBreakdown: MonthlyRevenue[]
  releaseBreakdown: ReleaseRevenue[]
  /** Revenue from physical releases (excl. Darkmerch). */
  physicalReleasesRevenue: number
  /** Digital revenue after label distribution fee deduction. */
  digitalRevenueAfterFee: number
  /** Believe digital revenue after label distribution fee deduction. */
  believeDigitalRevenueAfterFee: number
  /** Bandcamp digital revenue after label distribution fee deduction. */
  bandcampDigitalRevenueAfterFee: number
  /** Other digital revenue (not Believe, not Bandcamp) after label distribution fee deduction. */
  otherDigitalRevenueAfterFee: number
  /** Physical releases revenue after label distribution fee deduction. */
  physicalReleasesRevenueAfterFee: number
  /** Darkmerch revenue after label distribution fee deduction. */
  darkmerchRevenueAfterFee: number
  /** Split percentage (0–100) actually applied to digital revenue (representative fallback for display). */
  digitalSplitPercentage: number
  /** Split percentage (0–100) actually applied to Believe digital revenue. */
  believeSplitPercentage: number
  /** Split percentage (0–100) actually applied to Bandcamp revenue. */
  bandcampSplitPercentage: number
  /** Split percentage (0–100) actually applied to physical releases revenue. */
  physicalSplitPercentage: number
  /** Split percentage (0–100) actually applied to Darkmerch/merchandise revenue. */
  darkmerchSplitPercentage: number
}

export interface DataProcessorConfig {
  compilationFilters: CompilationFilter[]
  artistMappings: ArtistMapping[]
  splitFees: SplitFee[]
  manualRevenues: ManualRevenue[]
  /** Recoupable expense entries deducted per artist before split. */
  expenses?: ExpenseEntry[]
  excludePhysical?: boolean
  /** Exchange rates map (1 EUR = N units of foreign currency). Used to convert
   *  non-EUR Bandcamp transactions to EUR at processing time. */
  exchangeRates?: ExchangeRates
  /**
   * Historical monthly average exchange rates keyed by "YYYY-MM".
   * When provided, each transaction is converted using the ECB average rate for
   * its own `sales_month`, giving more accurate EUR figures for retrospective
   * statements.  Falls back to `exchangeRates` for any month not present here.
   */
  historicalExchangeRates?: HistoricalRates
  /**
   * When non-empty, only transactions whose resolved main artist appears in this
   * list are included. Co-artists not in the roster are silently dropped (their
   * transactions are re-attributed to the matching label artist).
   */
  labelArtists?: LabelArtist[]
  /**
   * Entries to exclude from all revenue calculations.
   * Each entry can target a specific artist or a specific release of an artist.
   */
  ignoredEntries?: IgnoredEntry[]
  /**
   * Rules that re-attribute all revenue from a matching track/release to a
   * single owner artist.  Applied after artist-mapping but before the roster
   * filter, so only the owner artist sees the track in their statement.
   */
  trackRevenueAssignments?: TrackRevenueAssignment[]
  /**
   * Label distribution fee as a percentage (0–100) deducted from each artist's
   * streaming/physical gross revenue before the split percentage is applied.
   */
  distributionFeePercentage?: number
  /**
   * Optional override distribution fee (0–100) applied exclusively to digital
   * (streaming) revenue. When set, overrides `distributionFeePercentage` for
   * digital revenue. Falls back to `distributionFeePercentage` when omitted.
   */
  distributionFeeDigital?: number
  /**
   * Optional override distribution fee (0–100) applied exclusively to physical
   * and merch revenue. When set, overrides `distributionFeePercentage` for
   * physical revenue. Falls back to `distributionFeePercentage` when omitted.
   */
  distributionFeePhysical?: number
  /**
   * Default artist split percentage (0–100) applied when no per-artist SplitFee
   * rule exists. Defaults to 100 (full pass-through) when omitted.
   */
  defaultSplitPercentage?: number
  /**
   * Optional default split percentage (0–100) for digital revenue only.
   * Overrides `defaultSplitPercentage` for digital when no per-artist digital
   * override exists. Falls back to `defaultSplitPercentage` when omitted.
   */
  defaultSplitPercentageDigital?: number
  /**
   * Optional default split percentage (0–100) for physical/merch revenue only.
   * Overrides `defaultSplitPercentage` for physical when no per-artist physical
   * override exists. Falls back to `defaultSplitPercentage` when omitted.
   */
  defaultSplitPercentagePhysical?: number
  /**
   * Global per-source split percentage overrides (0–100). Each field provides a
   * source-specific default that sits between per-artist overrides and the
   * generic label-wide defaults in the resolution chain.
   * Absent fields fall through to `defaultSplitPercentageDigital` /
   * `defaultSplitPercentagePhysical` / `defaultSplitPercentage`.
   */
  sourceSplits?: {
    believe?: number
    bandcamp?: number
    darkmerch?: number
    physical?: number
  }
}

export interface ProcessorResult {
  artistData: ProcessedArtistData[]
  filteredCompilations: FilteredCompilation[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function isCompilation(
  transaction: SalesTransaction,
  filters: CompilationFilter[]
): boolean {
  for (const filter of filters) {
    switch (filter.type) {
      case 'ean':
        // Exact match to prevent a short code from matching unrelated releases.
        if (
          transaction.upc_ean &&
          transaction.upc_ean.toLowerCase() === filter.identifier.toLowerCase()
        ) return true
        break
      case 'catalog':
        // Exact match for the same reason.
        if (
          transaction.catalog_number &&
          transaction.catalog_number.toLowerCase() === filter.identifier.toLowerCase()
        ) return true
        break
      case 'title':
        // Substring match is appropriate for human-readable titles.
        if (transaction.release_title?.toLowerCase().includes(filter.identifier.toLowerCase())) return true
        break
    }
  }
  return false
}

export function resolveMainArtist(
  originalArtist: string,
  mappings: ArtistMapping[]
): string {
  if (!originalArtist) return ''
  const lower = originalArtist.toLowerCase()
  const mapping = mappings.find(m => m.featuringName.toLowerCase() === lower)
  return mapping ? mapping.primaryArtist : originalArtist
}

/** Constrains a split percentage to the valid 0–100 range. */
function clampSplitPercentage(value: number): number {
  return Math.min(100, Math.max(0, value))
}

/**
 * Returns the first `ReleaseSplitOverride` whose `releaseTitle` is a
 * case-insensitive substring of the given `normalizedTitle`.
 * Returns `undefined` when no match is found.
 *
 * @param overrides - Array of per-release override entries to search.
 * @param normalizedTitle - Already-lowercased release title of the transaction group.
 */
function findReleaseOverride(
  overrides: ReleaseSplitOverride[],
  normalizedTitle: string
): ReleaseSplitOverride | undefined {
  return overrides.find(o => normalizedTitle.includes(o.releaseTitle.toLowerCase()))
}

/**
 * Resolves the effective distribution fee rate for a given revenue type.
 *
 * When a per-type override is configured it takes precedence over the global
 * fallback rate. This allows labels to charge, e.g., a higher fee on physical
 * merch than on digital streaming without touching every artist's individual
 * split rule.
 *
 * The result is a decimal rate (0–1), so a 15 % fee becomes 0.15.
 *
 * @param override - Per-type fee percentage (0–100) or `undefined` when not configured.
 * @param fallback - Global fee percentage (0–100) used when `override` is absent.
 */
function resolveDistributionFeeRate(override: number | undefined, fallback: number): number {
  return (override != null ? override : fallback) / 100
}

/**
 * Resolves the effective artist split percentage for a given revenue type.
 *
 * Fallback chain (highest → lowest priority):
 *   1. Per-artist type-specific override  (e.g. `splitFee.digitalPercentage` / `splitFee.physicalPercentage`)
 *   2. Label-wide type-specific default   (`defaultTypeOverride`, e.g. `defaultSplitPercentagePhysical`)
 *   3. Per-artist base percentage         (`splitFee.percentage`)
 *   4. Label-wide base default            (`defaultBase`)
 *
 * The label-wide type-specific default (step 2) intentionally sits ABOVE the per-artist base (step 3).
 * Rationale: `defaultSplitPercentageDigital` / `defaultSplitPercentagePhysical` are explicit label-wide
 * policies for a revenue type. An auto-assigned per-artist base `percentage` (e.g. created by
 * `useSplitFeeSync`) must not silently override a deliberately configured type-specific policy.
 * Only an explicit per-artist `digitalPercentage` / `physicalPercentage` can override the label default.
 *
 * @param splitFee - The artist's split-fee entry from the config, or `undefined` when no rule is configured.
 * @param typeOverride - Revenue type determining which optional override field to read.
 * @param defaultBase - Label-wide default split percentage (0–100); used when no per-artist rule exists.
 * @param defaultTypeOverride - Label-wide type-specific default (0–100); overrides `defaultBase` for this type.
 */
function resolveSplitPercentage(
  splitFee: { percentage: number; digitalPercentage?: number; physicalPercentage?: number } | undefined,
  typeOverride: 'digital' | 'physical',
  defaultBase: number = 100,
  defaultTypeOverride?: number
): number {
  const perArtistTypeOverride = typeOverride === 'digital'
    ? splitFee?.digitalPercentage
    : splitFee?.physicalPercentage
  // 1. Explicit per-artist type override wins unconditionally.
  if (perArtistTypeOverride != null) return clampSplitPercentage(perArtistTypeOverride)
  // 2. Label-wide type default beats the per-artist base so that a label policy such as
  //    "all physical = 15%" applies even to artists with an auto-assigned base rate of 50%.
  if (defaultTypeOverride != null) return clampSplitPercentage(defaultTypeOverride)
  // 3 & 4. Per-artist base, then ultimate label-wide base.
  return clampSplitPercentage(splitFee?.percentage ?? defaultBase)
}

/**
 * Resolves the effective artist split percentage for a transaction source.
 *
 * Resolution priority (highest → lowest):
 *   1. Per-source override    (`splitFee.sourceOverrides` for this source)
 *   2. Per-type override      (`splitFee.digitalPercentage` / `splitFee.physicalPercentage`)
 *   3. Label-wide type default (`defaultTypeOverride`) — e.g. `defaultSplitPercentagePhysical`.
 *                             Sits ABOVE the per-artist base so that an explicit label policy
 *                             (e.g. "all physical = 15%") applies even to artists whose base
 *                             percentage was auto-assigned. See `resolveSplitPercentage`.
 *   4. Per-artist base        (`splitFee.percentage`)
 *   5. Global source split    (`sourceSplits` in DataProcessorConfig for this source)
 *                             — only reached when the artist has NO per-artist SplitFee entry.
 *   6. Label-wide base default (`defaultBase`)
 *
 * @param splitFee - The artist's SplitFee entry, or `undefined` when none configured.
 * @param source - Transaction source to check for a named source override (`'darkmerch'`,
 *   `'bandcamp'`, …), or `null` for aggregated buckets (digital total, physical total).
 *   When `null` the caller is responsible for merging the relevant `sourceSplits` value
 *   into `defaultTypeOverride`.
 * @param isPhysical - Whether to use the physical or digital type-override chain.
 * @param defaultBase - Label-wide base default split percentage (0–100).
 * @param defaultTypeOverride - Effective label-wide type-specific default (0–100).
 *   Callers should pre-compute this as `sourceSplits.{type} ?? defaultSplitPercentage{Type}`
 *   so that source-specific label defaults are honoured for artists without per-artist splits.
 * @param globalSourceSplits - Label-wide per-source split defaults (0–100). Only consulted
 *   when `source` is a named source AND `splitFee` is `undefined`.
 */
function resolveSplitPercentageWithSourceOverride(
  splitFee: SplitFee | undefined,
  source: TransactionSource | null,
  isPhysical: boolean,
  defaultBase: number,
  defaultTypeOverride?: number,
  globalSourceSplits?: { believe?: number; bandcamp?: number; darkmerch?: number; physical?: number }
): number {
  // 1. Per-artist source override (highest priority)
  if (source != null && splitFee?.sourceOverrides != null) {
    const sourceOverride = splitFee.sourceOverrides.find(o => o.source === source)
    if (sourceOverride != null) return clampSplitPercentage(sourceOverride.percentage)
  }
  // 2–4. Per-artist type override → label-wide type default → per-artist base
  if (splitFee != null) {
    return resolveSplitPercentage(splitFee, isPhysical ? 'physical' : 'digital', defaultBase, defaultTypeOverride)
  }
  // 5. Global per-source split (only when artist has no SplitFee entry at all)
  if (source != null && globalSourceSplits != null) {
    let globalPct: number | undefined
    if (source === 'believe') globalPct = globalSourceSplits.believe
    else if (source === 'bandcamp') globalPct = globalSourceSplits.bandcamp
    else if (source === 'darkmerch') globalPct = globalSourceSplits.darkmerch
    else if (source === 'shopify' || source === 'printful') globalPct = globalSourceSplits.physical
    if (globalPct != null) return clampSplitPercentage(globalPct)
  }
  // 5–6. Label-wide type / base defaults (callers pre-merge sourceSplits for source=null buckets)
  const effectiveDefault = defaultTypeOverride ?? defaultBase
  return clampSplitPercentage(effectiveDefault)
}

function aggregateBy<K extends string>(
  items: { key: K; revenue: number; quantity: number }[]
): Map<K, { revenue: number; quantity: number }> {
  const map = new Map<K, { revenue: number; quantity: number }>()
  for (const { key, revenue, quantity } of items) {
    const existing = map.get(key) ?? { revenue: 0, quantity: 0 }
    map.set(key, { revenue: existing.revenue + revenue, quantity: existing.quantity + quantity })
  }
  return map
}

function buildPlatformBreakdown(transactions: SalesTransaction[]): PlatformRevenue[] {
  const map = new Map<string, { revenue: number; quantity: number; downloads: number; streams: number; hasTypeInfo: boolean }>()
  for (const t of transactions) {
    const key = t.platform || 'Unknown'
    const existing = map.get(key) ?? { revenue: 0, quantity: 0, downloads: 0, streams: 0, hasTypeInfo: false }
    const hasTypeInfo = !t.is_physical && t.is_download !== undefined
    map.set(key, {
      revenue: existing.revenue + t.net_revenue,
      quantity: existing.quantity + t.quantity,
      downloads: existing.downloads + (!t.is_physical && t.is_download === true ? t.quantity : 0),
      streams: existing.streams + (!t.is_physical && t.is_download === false ? t.quantity : 0),
      hasTypeInfo: existing.hasTypeInfo || hasTypeInfo,
    })
  }
  return Array.from(map.entries())
    .map(([platform, { revenue, quantity, downloads, streams, hasTypeInfo }]) => ({
      platform,
      revenue,
      quantity,
      ...(hasTypeInfo ? { downloadQuantity: downloads, streamQuantity: streams } : {}),
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

function buildCountryBreakdown(transactions: SalesTransaction[]): CountryRevenue[] {
  // Only include transactions that carry a known country.  Items without a
  // country (e.g. physical merch / Darkmerch orders) are absorbed into the
  // overall revenue totals and must not appear as an "Unknown" row here.
  const agg = aggregateBy(
    transactions
      .filter(t => t.country)
      .map(t => ({ key: t.country, revenue: t.net_revenue, quantity: t.quantity }))
  )
  return Array.from(agg.entries())
    .map(([country, { revenue, quantity }]) => ({ country, revenue, quantity }))
    .sort((a, b) => b.revenue - a.revenue)
}

function parseMonthToDate(month: string): number {
  if (!month || month === 'Unknown') return 0
  // Dates are normalised to YYYY-MM by the streaming parser.
  const d = new Date(month + '-01')
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

function buildMonthlyBreakdown(transactions: SalesTransaction[]): MonthlyRevenue[] {
  const map = new Map<string, number>()
  for (const t of transactions) {
    // Skip items without a valid sales month (e.g. physical merch / Darkmerch
    // orders with no date).  Their revenue is already included in the overall
    // totals and must not appear as an "Unknown" row in this breakdown.
    if (!t.sales_month) continue
    map.set(t.sales_month, (map.get(t.sales_month) ?? 0) + t.net_revenue)
  }
  return Array.from(map.entries())
    .map(([month, revenue]) => ({ month, revenue }))
    .sort((a, b) => parseMonthToDate(a.month) - parseMonthToDate(b.month))
}

function buildReleaseBreakdown(transactions: SalesTransaction[]): ReleaseRevenue[] {
  const map = new Map<string, ReleaseRevenue>()
  for (const t of transactions) {
    // Use a normalised lowercase key so the same release with different casing is grouped together.
    const key = (t.upc_ean || t.catalog_number || t.release_title || 'Unknown').toLowerCase()
    const existing = map.get(key)
    if (existing) {
      existing.revenue += t.net_revenue
      existing.quantity += t.quantity
    } else {
      map.set(key, {
        releaseTitle: t.release_title || '',
        upcEan: t.upc_ean || '',
        catalogNumber: t.catalog_number || '',
        revenue: t.net_revenue,
        quantity: t.quantity,
        isPhysical: t.is_physical,
      })
    }
  }
  /**
   * Second pass: merge entries that share the same normalized release title.
   *
   * Why this exists:
   * Some sources provide stable identifiers (UPC/catalog) while others only
   * provide release titles for the same record. The first pass groups by
   * identifier, but that can still leave duplicate rows for one release.
   *
   * Behavior:
   * - Normalizes title matching via trim + lowercase
   * - Merges revenue/quantity for matching titles
   * - Keeps untitled entries distinct to avoid false merges
   *
   * Known limitation:
   * This intentionally does not collapse punctuation/Unicode variants.
   * If upstream sources emit materially different title spellings, those
   * remain separate entries to avoid accidental over-aggregation.
   */
  const byTitle = new Map<string, ReleaseRevenue>()
  const untitled: ReleaseRevenue[] = []
  for (const entry of map.values()) {
    const titleKey = entry.releaseTitle.trim().toLowerCase()
    if (!titleKey) {
      untitled.push(entry)
      continue
    }
    const existing = byTitle.get(titleKey)
    if (existing) {
      existing.revenue += entry.revenue
      existing.quantity += entry.quantity
    } else {
      byTitle.set(titleKey, entry)
    }
  }
  return [...byTitle.values(), ...untitled].sort((a, b) => b.revenue - a.revenue)
}

// ── Main processing ────────────────────────────────────────────────────────────

/**
 * Resolves a TrackRevenueAssignment to a normalised list of **active** owners
 * with fractional revenue shares (0–1).
 *
 * Owners with `percentage <= 0` or an empty `artist` name are excluded so that
 * no transaction is ever cloned and attributed to them. This guarantees that
 * a track assigned 100% to Artist A never appears in Artist B's statement,
 * even when Artist B is listed as a co-owner with 0%.
 *
 * Math invariant: when the original percentages summed to 100 and only
 * zero-percentage entries are dropped, the sum of the remaining fractions is
 * still exactly 1, so total revenue is preserved.
 *
 * Backward-compat: when `owners` is absent or empty, falls back to
 * `ownerArtist` at fraction 1 (100%). This preserves behaviour for all
 * workspace backups created before multi-owner support was introduced.
 *
 * @param assignment - The rule to resolve.
 * @returns An array of `{ artist, fraction }` entries for every owner whose
 *   percentage is > 0 and whose artist name is non-empty. Guaranteed
 *   non-empty in practice because the UI enforces a 100% sum with at least
 *   one positive share before allowing submission.
 */
function resolveAssignmentOwners(
  assignment: TrackRevenueAssignment
): ReadonlyArray<{ readonly artist: string; readonly fraction: number }> {
  if (assignment.owners && assignment.owners.length > 0) {
    return assignment.owners
      .filter(o => o.percentage > 0 && o.artist.trim() !== '')
      .map(o => ({
        artist: o.artist,
        fraction: o.percentage / 100,
      }))
  }
  const legacyArtist = assignment.ownerArtist ?? ''
  return [{ artist: legacyArtist, fraction: 1 }]
}

export function processTransactions(
  transactions: SalesTransaction[],
  config: DataProcessorConfig
): ProcessedArtistData[] {
  return processTransactionsWithCompilations(transactions, config).artistData
}

export function processTransactionsWithCompilations(
  transactions: SalesTransaction[],
  config: DataProcessorConfig
): ProcessorResult {
  // Identify compilation transactions for reporting purposes only.
  // They still count toward artist revenue (Bug 3b fix).
  const compilationTransactionIds = new Set<string>()
  for (const t of transactions) {
    if (isCompilation(t, config.compilationFilters)) {
      compilationTransactionIds.add(t.id)
    }
  }

  // Build filtered compilation summary (informational panel only)
  const compilationMap = new Map<string, FilteredCompilation>()
  for (const t of transactions) {
    if (!compilationTransactionIds.has(t.id)) continue

    const matchingFilter = config.compilationFilters.find(f => {
      switch (f.type) {
        case 'ean': return t.upc_ean?.toLowerCase() === f.identifier.toLowerCase()
        case 'catalog': return t.catalog_number?.toLowerCase() === f.identifier.toLowerCase()
        case 'title': return t.release_title?.toLowerCase().includes(f.identifier.toLowerCase())
        default: return false
      }
    })
    if (!matchingFilter) continue

    const key = matchingFilter.id
    const existing = compilationMap.get(key)
    if (existing) {
      existing.revenue += t.net_revenue
      existing.transactionCount += 1
    } else {
      compilationMap.set(key, {
        releaseTitle: t.release_title || matchingFilter.identifier,
        identifier: matchingFilter.identifier,
        filterType: matchingFilter.type,
        revenue: t.net_revenue,
        transactionCount: 1,
      })
    }
  }

  const filteredCompilations = Array.from(compilationMap.values()).sort(
    (a, b) => b.revenue - a.revenue
  )

  // Apply physical exclusion to all transactions (compilations are still counted)
  const workingTransactions = config.excludePhysical
    ? transactions.filter(t => !t.is_physical)
    : transactions

  // Resolve artist names via mappings
  const resolved = workingTransactions.map(t => ({
    ...t,
    main_artist: resolveMainArtist(t.original_artist, config.artistMappings),
  }))

  // ── Track revenue assignment ───────────────────────────────────────────────
  // When a rule matches, revenue is proportionally distributed among co-owners
  // by cloning the transaction with a scaled net_revenue and quantity per owner.
  // Single-owner rules (legacy or new) are handled without cloning for perf.
  // Runs after artist-mapping but before the roster filter.
  const trackAssignments = config.trackRevenueAssignments ?? []

  const assigned: typeof resolved = trackAssignments.length === 0
    ? resolved
    : resolved.flatMap(t => {
        const relLower = (t.release_title ?? '').toLowerCase()
        const trkLower = (t.track_title ?? '').toLowerCase()
        const match = trackAssignments.find(
          a =>
            a.trackTitle.trim() !== '' &&
            (relLower.includes(a.trackTitle.trim().toLowerCase()) ||
              trkLower.includes(a.trackTitle.trim().toLowerCase()))
        )

        if (!match) return [t]

        const owners = resolveAssignmentOwners(match)

        // Single-owner fast path — simple re-attribution, no clone needed.
        // Only skip scaling when the sole owner holds the full 100% (fraction
        // === 1).  If a co-owner was filtered out (e.g. empty artist name with
        // a non-zero percentage), the remaining fraction may be < 1, so we
        // fall through to the multi-owner scaling path to honour that share.
        if (owners.length === 1 && owners[0].fraction === 1) {
          return [{ ...t, main_artist: owners[0].artist }]
        }

        // Multi-owner path — clone transaction with scaled revenue per owner.
        // ID is suffixed to guarantee uniqueness in downstream Maps.
        return owners.map(owner => ({
          ...t,
          id: `${t.id}__split__${owner.artist}`,
          main_artist: owner.artist,
          net_revenue: t.net_revenue * owner.fraction,
          quantity: Math.round(t.quantity * owner.fraction),
        }))
      })

  // ── Label artist roster filter ─────────────────────────────────────────────
  // When the roster is non-empty, re-attribute transactions whose original
  // artist string contains a label artist (comma/ampersand/feat. separated)
  // to that label artist.  Transactions with no label artist are dropped.
  const rosterNames =
    config.labelArtists && config.labelArtists.length > 0
      ? config.labelArtists.map(la => la.name.trim().toLowerCase())
      : null

  const rosterFiltered = rosterNames
    ? assigned.flatMap(t => {
        // Check if the resolved main artist itself is in the roster
        if (rosterNames.includes(t.main_artist.trim().toLowerCase())) {
          return [t]
        }
        // Try to find a label artist within the original_artist string
        // (handles "Neuroklast, mechanical vein" or "Neuroklast feat. X")
        const found = rosterNames.find(rn =>
          t.original_artist.trim().toLowerCase() === rn ||
          t.original_artist.toLowerCase().split(/\s*[,&]\s*|\s+feat(?:uring)?\.?\s+|\s+ft\.?\s+/i).some(
            part => part.trim().toLowerCase() === rn
          )
        )
        if (!found) return []
        // Re-attribute to the canonical roster name (fall back to found name if lookup fails)
        const canonical =
          config.labelArtists?.find(la => la.name.trim().toLowerCase() === found)?.name ?? found
        return [{ ...t, main_artist: canonical }]
      })
    : assigned

  // ── Ignored entries filter ─────────────────────────────────────────────────
  const ignoredEntries = config.ignoredEntries ?? []
  const rosterAndIgnoreFiltered =
    ignoredEntries.length === 0
      ? rosterFiltered
      : rosterFiltered.filter(t => {
          const artistLower = t.main_artist.trim().toLowerCase()
          return !ignoredEntries.some(ie => {
            if (ie.artist.trim().toLowerCase() !== artistLower) return false
            if (!ie.releaseTitle) return true // whole artist ignored
            return (
              t.release_title?.trim().toLowerCase() === ie.releaseTitle.trim().toLowerCase()
            )
          })
        })

  // Group by resolved artist (case-insensitive: "NEUROKLAST" == "Neuroklast")
  const artistGroups = new Map<string, SalesTransaction[]>()
  // Stores the first-seen canonical casing for each lowercase key.
  const canonicalArtistNames = new Map<string, string>()
  for (const t of rosterAndIgnoreFiltered) {
    const key = t.main_artist.toLowerCase()
    if (!canonicalArtistNames.has(key)) {
      canonicalArtistNames.set(key, t.main_artist)
    }
    const group = artistGroups.get(key)
    if (group) {
      group.push(t)
    } else {
      artistGroups.set(key, [t])
    }
  }

  // Build per-artist data with all breakdowns
  const artistData: ProcessedArtistData[] = []

  const rates = config.exchangeRates ?? {}
  const historicalRates = config.historicalExchangeRates ?? {}

  for (const [lowerKey, artistTransactions] of artistGroups.entries()) {
    const artist = canonicalArtistNames.get(lowerKey) ?? lowerKey
    let digitalRevenue = 0
    let physicalRevenue = 0
    let totalQuantity = 0
    // Digital sub-buckets: tracked separately for per-source split application
    let believeDigitalRevenue = 0
    let bandcampDigitalRevenue = 0
    let otherDigitalRevenue = 0

    // Create EUR-normalised versions of the transactions for breakdown functions.
    // When historical monthly rates are available, use the rate for the
    // transaction's own sales_month; fall back to the flat `rates` map otherwise.
    const eurTransactions = artistTransactions.map(t => {
      const applicableRates = (t.sales_month && historicalRates[t.sales_month]) ? historicalRates[t.sales_month] : rates
      const revenueEur = t.source === 'bandcamp' && t.currency !== 'EUR'
        ? convertToEur(t.net_revenue, t.currency, applicableRates)
        : t.net_revenue
      return { ...t, net_revenue: revenueEur }
    })

    for (const t of eurTransactions) {
      totalQuantity += t.quantity
      if (t.is_physical) {
        physicalRevenue += t.net_revenue
      } else {
        digitalRevenue += t.net_revenue
        if (t.source === 'believe') {
          believeDigitalRevenue += t.net_revenue
        } else if (t.source === 'bandcamp') {
          bandcampDigitalRevenue += t.net_revenue
        } else {
          otherDigitalRevenue += t.net_revenue
        }
      }
    }

    // Download vs stream revenue split (digital only)
    const totalDownloadRevenue = eurTransactions
      .filter(t => !t.is_physical && t.is_download === true)
      .reduce((s, t) => s + t.net_revenue, 0)
    const totalStreamRevenue = eurTransactions
      .filter(t => !t.is_physical && t.is_download === false)
      .reduce((s, t) => s + t.net_revenue, 0)

    // Per-source EUR revenue — computed from EUR-normalised transactions so the
    // values are consistent with grossRevenue (both use the same EUR amounts).
    const believeRevenue = eurTransactions
      .filter(t => t.source === 'believe')
      .reduce((s, t) => s + t.net_revenue, 0)
    const bandcampRevenue = eurTransactions
      .filter(t => t.source === 'bandcamp')
      .reduce((s, t) => s + t.net_revenue, 0)
    const darkmerchRevenue = eurTransactions
      .filter(t => t.source === 'darkmerch')
      .reduce((s, t) => s + t.net_revenue, 0)

    const artistManualRevenues = config.manualRevenues.filter(mr => mr.artist.toLowerCase() === lowerKey)
    const manualRevenue = artistManualRevenues.reduce((sum, mr) => sum + mr.amount, 0)
    const manualRevenueEntries = artistManualRevenues.map(mr => ({ description: mr.description, amount: mr.amount }))

    // Recoupable expenses: deducted from streaming/physical revenue before split.
    const artistExpenses = (config.expenses ?? []).filter(e => e.artist.toLowerCase() === lowerKey)
    const totalExpenses = artistExpenses.reduce((sum, e) => sum + e.amount, 0)
    const expenseEntries = artistExpenses.map(e => ({ description: e.description, amount: e.amount, date: e.date }))

    // Distribution fee: a percentage of streaming/physical revenue retained by
    // the label before the artist's split is calculated.
    // Per-type overrides take precedence over the global rate.
    const globalFeeDefault = config.distributionFeePercentage ?? 0
    const digitalFeeRate = resolveDistributionFeeRate(config.distributionFeeDigital, globalFeeDefault)
    const physicalFeeRate = resolveDistributionFeeRate(config.distributionFeePhysical, globalFeeDefault)

    // Separate Darkmerch from physical releases for independent split application.
    // Darkmerch always has is_physical=true but may carry its own source override.
    const darkmerchTxRevenue = eurTransactions
      .filter(t => t.source === 'darkmerch')
      .reduce((s, t) => s + t.net_revenue, 0)
    const physicalReleasesRevenue = physicalRevenue - darkmerchTxRevenue

    // Distribution fee per bucket (darkmerch uses same physicalFeeRate as physical releases)
    const digitalFeeDeducted = digitalRevenue * digitalFeeRate
    const physicalReleasesFeeDeducted = physicalReleasesRevenue * physicalFeeRate
    const darkmerchFeeDeducted = darkmerchTxRevenue * physicalFeeRate
    const distributionFeeDeducted = digitalFeeDeducted + physicalReleasesFeeDeducted + darkmerchFeeDeducted

    // Revenue after fee deduction per bucket
    const digitalAfterFee = digitalRevenue - digitalFeeDeducted
    const believeDigitalAfterFee = believeDigitalRevenue - believeDigitalRevenue * digitalFeeRate
    const bandcampDigitalAfterFee = bandcampDigitalRevenue - bandcampDigitalRevenue * digitalFeeRate
    const otherDigitalAfterFee = otherDigitalRevenue - otherDigitalRevenue * digitalFeeRate
    const physicalReleasesAfterFee = physicalReleasesRevenue - physicalReleasesFeeDeducted
    const darkmerchAfterFee = darkmerchTxRevenue - darkmerchFeeDeducted

    const grossRevenue = digitalRevenue + physicalRevenue + manualRevenue

    const defaultBase = config.defaultSplitPercentage ?? 100
    const splitFee = config.splitFees.find(sf => sf.artist.toLowerCase() === lowerKey)

    // ─── Bucket split resolution ───────────────────────────────────────────
    // Two completely independent systems — activated only when the bucket value IS set:
    //
    // A. BUCKET SPLIT (parallel, when sourceSplits.{bucket} IS configured):
    //    The configured rate is used directly for that revenue bucket.
    //    Per-artist base / type percentages do NOT apply.
    //    The ONLY override is an explicit per-artist sourceOverride for that source.
    //    Priority: perArtistSourceOverride > sourceSplits.{bucket}
    //
    // B. MAIN CHAIN (when no bucket split is configured for the bucket):
    //    Priority (highest → lowest):
    //      perArtistTypeOverride → globalTypeDefault → perArtistBase → globalBase
    //    Note: the label-wide type default (e.g. defaultSplitPercentagePhysical) intentionally
    //    beats the per-artist base so that a label policy like "all physical = 15%" is respected
    //    even for artists whose base was auto-assigned. Only an explicit per-artist
    //    digitalPercentage / physicalPercentage field can override the label type policy.

    // Digital bucket — resolved per source
    // Priority per source: perArtistSourceOverride > sourceSplits.{source} > digital main chain
    //
    // The main chain is computed once and reused for any source that has no bucket split.
    const mainChainDigitalSplitPct = resolveSplitPercentageWithSourceOverride(
      splitFee, null, false, defaultBase, config.defaultSplitPercentageDigital
    )

    // Believe bucket
    const believeSourceOverride = splitFee?.sourceOverrides?.find(o => o.source === 'believe')
    const believeSplitPct = believeSourceOverride != null
      ? clampSplitPercentage(believeSourceOverride.percentage)
      : config.sourceSplits?.believe != null
        ? clampSplitPercentage(config.sourceSplits.believe)
        : mainChainDigitalSplitPct

    // Bandcamp bucket
    const bandcampSourceOverride = splitFee?.sourceOverrides?.find(o => o.source === 'bandcamp')
    const bandcampSplitPct = bandcampSourceOverride != null
      ? clampSplitPercentage(bandcampSourceOverride.percentage)
      : config.sourceSplits?.bandcamp != null
        ? clampSplitPercentage(config.sourceSplits.bandcamp)
        : mainChainDigitalSplitPct

    // Other digital sources (no source-specific bucket; uses digital main chain)
    const otherDigitalSplitPct = mainChainDigitalSplitPct

    // Representative digital split for backward-compat display:
    // prefer believeSplitPct when the believe bucket is active, then bandcamp, then main chain.
    const digitalSplitPct = config.sourceSplits?.believe != null
      ? believeSplitPct
      : config.sourceSplits?.bandcamp != null
        ? bandcampSplitPct
        : otherDigitalSplitPct

    // Physical releases bucket
    const physicalBucketPerArtistOverride = splitFee?.sourceOverrides?.find(
      o => o.source === 'shopify' || o.source === 'printful'
    )
    const physicalSplitPct = (() => {
      // 1. Per-artist source override (highest priority)
      if (physicalBucketPerArtistOverride != null) {
        return clampSplitPercentage(physicalBucketPerArtistOverride.percentage)
      }
      // 2. Per-artist physical percentage beats the bucket split when explicitly set
      if (splitFee?.physicalPercentage != null) {
        return clampSplitPercentage(splitFee.physicalPercentage)
      }
      // 3. Bucket split (General Settings Physical Split %)
      if (config.sourceSplits?.physical != null) {
        return clampSplitPercentage(config.sourceSplits.physical)
      }
      // 4. Main chain fallback
      return resolveSplitPercentageWithSourceOverride(
        splitFee, null, true, defaultBase, config.defaultSplitPercentagePhysical
      )
    })()

    // Darkmerch bucket
    const darkmerchPerArtistOverride = splitFee?.sourceOverrides?.find(o => o.source === 'darkmerch')
    const darkmerchSplitPct = config.sourceSplits?.darkmerch != null
      ? clampSplitPercentage(darkmerchPerArtistOverride?.percentage ?? config.sourceSplits.darkmerch)
      : resolveSplitPercentageWithSourceOverride(
          splitFee, 'darkmerch', true, defaultBase, config.defaultSplitPercentagePhysical, config.sourceSplits
        )

    // splitPercentage for backward-compat display: use digitalSplitPct when no physical revenue
    const splitPercentage = (physicalReleasesRevenue === 0 && darkmerchTxRevenue === 0)
      ? digitalSplitPct
      : clampSplitPercentage(splitFee?.percentage ?? defaultBase)

    // Distribution fee is deducted before split.
    // Recoupable expenses are deducted AFTER split.
    // Manual revenues are added AFTER split.
    let finalPayout: number

    const releaseOverrides = splitFee?.releaseOverrides
    if (releaseOverrides != null && releaseOverrides.length > 0) {
      // Per-release override path: compute payout per release group so that
      // individual release overrides can take effect for specific titles.
      // Group by normalised release_title so that the override lookup key and
      // the grouping key are always the same field — this prevents mismatches
      // that would occur if grouping used upc_ean/catalog_number while the
      // override lookup used release_title.
      const releaseGroups = new Map<string, SalesTransaction[]>()
      for (const t of eurTransactions) {
        const key = (t.release_title || 'Unknown').toLowerCase()
        const group = releaseGroups.get(key)
        if (group) {
          group.push(t)
        } else {
          releaseGroups.set(key, [t])
        }
      }

      let perReleasePayout = 0
      for (const [releaseKey, releaseTxs] of releaseGroups.entries()) {
        let releaseBelieveDigital = 0
        let releaseBandcampDigital = 0
        let releaseOtherDigital = 0
        let releasePhysicalReleases = 0
        let releaseDarkmerch = 0
        for (const t of releaseTxs) {
          if (t.source === 'darkmerch') {
            releaseDarkmerch += t.net_revenue
          } else if (t.is_physical) {
            releasePhysicalReleases += t.net_revenue
          } else if (t.source === 'believe') {
            releaseBelieveDigital += t.net_revenue
          } else if (t.source === 'bandcamp') {
            releaseBandcampDigital += t.net_revenue
          } else {
            releaseOtherDigital += t.net_revenue
          }
        }

        const releaseBelieveDigitalAfterFee = releaseBelieveDigital - releaseBelieveDigital * digitalFeeRate
        const releaseBandcampDigitalAfterFee = releaseBandcampDigital - releaseBandcampDigital * digitalFeeRate
        const releaseOtherDigitalAfterFee = releaseOtherDigital - releaseOtherDigital * digitalFeeRate
        const releasePhysicalAfterFee = releasePhysicalReleases - releasePhysicalReleases * physicalFeeRate
        const releaseDarkmerchAfterFee = releaseDarkmerch - releaseDarkmerch * physicalFeeRate

        const matchedOverride = findReleaseOverride(releaseOverrides, releaseKey)

        // When a release override is active, all digital sub-buckets share the same
        // override percentage (release overrides do not distinguish between sources).
        const effectiveBelievePct = matchedOverride != null
          ? clampSplitPercentage(matchedOverride.percentage)
          : believeSplitPct
        const effectiveBandcampPct = matchedOverride != null
          ? clampSplitPercentage(matchedOverride.percentage)
          : bandcampSplitPct
        const effectiveOtherDigitalPct = matchedOverride != null
          ? clampSplitPercentage(matchedOverride.percentage)
          : otherDigitalSplitPct
        const effectivePhysicalPct = matchedOverride != null
          ? clampSplitPercentage(matchedOverride.physicalPercentage ?? matchedOverride.percentage)
          : physicalSplitPct
        // Release overrides use physicalPercentage for darkmerch too (they take precedence
        // over source overrides). When no release override matches, darkmerch uses its own
        // source-resolved split.
        const effectiveDarkmerchPct = matchedOverride != null
          ? clampSplitPercentage(matchedOverride.physicalPercentage ?? matchedOverride.percentage)
          : darkmerchSplitPct

        perReleasePayout +=
          releaseBelieveDigitalAfterFee * (effectiveBelievePct / 100) +
          releaseBandcampDigitalAfterFee * (effectiveBandcampPct / 100) +
          releaseOtherDigitalAfterFee * (effectiveOtherDigitalPct / 100) +
          releasePhysicalAfterFee * (effectivePhysicalPct / 100) +
          releaseDarkmerchAfterFee * (effectiveDarkmerchPct / 100)
      }

      finalPayout = perReleasePayout - totalExpenses + manualRevenue
    } else {
      // Standard path (no release overrides)
      finalPayout =
        believeDigitalAfterFee * (believeSplitPct / 100) +
          bandcampDigitalAfterFee * (bandcampSplitPct / 100) +
          otherDigitalAfterFee * (otherDigitalSplitPct / 100) +
          physicalReleasesAfterFee * (physicalSplitPct / 100) +
          darkmerchAfterFee * (darkmerchSplitPct / 100) -
          totalExpenses +
          manualRevenue
    }

    artistData.push({
      artist,
      transactions: artistTransactions,
      believeRevenue,
      bandcampRevenue,
      darkmerchRevenue,
      totalDigitalRevenue: digitalRevenue,
      totalPhysicalRevenue: physicalRevenue,
      totalDownloadRevenue,
      totalStreamRevenue,
      manualRevenue,
      manualRevenueEntries,
      grossRevenue,
      splitPercentage,
      finalPayout,
      totalQuantity,
      totalExpenses,
      expenseEntries,
      distributionFeeDeducted,
      physicalReleasesRevenue,
      digitalRevenueAfterFee: digitalAfterFee,
      believeDigitalRevenueAfterFee: believeDigitalAfterFee,
      bandcampDigitalRevenueAfterFee: bandcampDigitalAfterFee,
      otherDigitalRevenueAfterFee: otherDigitalAfterFee,
      physicalReleasesRevenueAfterFee: physicalReleasesAfterFee,
      darkmerchRevenueAfterFee: darkmerchAfterFee,
      digitalSplitPercentage: digitalSplitPct,
      believeSplitPercentage: believeSplitPct,
      bandcampSplitPercentage: bandcampSplitPct,
      physicalSplitPercentage: physicalSplitPct,
      darkmerchSplitPercentage: darkmerchSplitPct,
      platformBreakdown: buildPlatformBreakdown(eurTransactions),
      countryBreakdown: buildCountryBreakdown(eurTransactions),
      monthlyBreakdown: buildMonthlyBreakdown(eurTransactions),
      releaseBreakdown: buildReleaseBreakdown(eurTransactions),
    })
  }

  artistData.sort((a, b) => b.finalPayout - a.finalPayout)

  return { artistData, filteredCompilations }
}

export function getUniqueArtistsFromTransactions(
  transactions: SalesTransaction[],
  mappings: ArtistMapping[]
): string[] {
  const artistSet = new Set<string>()
  for (const t of transactions) {
    artistSet.add(resolveMainArtist(t.original_artist, mappings))
  }
  return Array.from(artistSet).sort()
}

// ── Tree view builder ──────────────────────────────────────────────────────────

import type { ArtistTreeNode, ReleaseWithTracks, TrackData } from './types'

/**
 * Builds a full artist → release → track hierarchy from processed data.
 * Used by the ArtistTreeView component.
 */
export function buildArtistTree(
  artistData: ProcessedArtistData[]
): ArtistTreeNode[] {
  return artistData.map(data => {
    // Group transactions by release key
    const releaseMap = new Map<string, { meta: Omit<ReleaseWithTracks, 'tracks'>; trackMap: Map<string, TrackData> }>()

    for (const t of data.transactions) {
      const releaseKey = t.upc_ean || t.catalog_number || t.release_title || 'Unknown'
      let release = releaseMap.get(releaseKey)
      if (!release) {
        release = {
          meta: {
            releaseTitle: t.release_title || '',
            upcEan: t.upc_ean || '',
            catalogNumber: t.catalog_number || '',
            isPhysical: t.is_physical,
            revenue: 0,
            quantity: 0,
          },
          trackMap: new Map(),
        }
        releaseMap.set(releaseKey, release)
      }
      release.meta.revenue += t.net_revenue
      release.meta.quantity += t.quantity

      // Group by track
      const trackKey = t.isrc || t.track_title || 'Unknown Track'
      const existingTrack = release.trackMap.get(trackKey)
      if (existingTrack) {
        existingTrack.revenue += t.net_revenue
        existingTrack.quantity += t.quantity
        if (t.platform && !existingTrack.platforms.includes(t.platform)) {
          existingTrack.platforms.push(t.platform)
        }
      } else {
        release.trackMap.set(trackKey, {
          trackTitle: t.track_title || 'Unknown Track',
          isrc: t.isrc || '',
          revenue: t.net_revenue,
          quantity: t.quantity,
          platforms: t.platform ? [t.platform] : [],
        })
      }
    }

    const releases: ReleaseWithTracks[] = Array.from(releaseMap.values())
      .map(({ meta, trackMap }) => ({
        ...meta,
        tracks: Array.from(trackMap.values()).sort((a, b) => b.revenue - a.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue)

    return {
      artist: data.artist,
      totalRevenue: data.grossRevenue,
      finalPayout: data.finalPayout,
      splitPercentage: data.splitPercentage,
      quantity: data.totalQuantity,
      releases,
    }
  })
}

/**
 * Extracts the main artist and guest artists from a title/artist string.
 * Handles: feat., ft., featuring, versus, vs., x (standalone word)
 */
export function extractCollabs(title: string): { mainArtist: string; guestArtists: string[] } {
  if (!title || !title.trim()) return { mainArtist: '', guestArtists: [] }

  const featRegex = /\s*[[(]?\s*(?:feat(?:uring)?\.?|ft\.?)\s*/gi
  const versusRegex = /\s+(?:versus|vs\.?)\s+/gi

  const featParts = title.split(featRegex).map(p => p.replace(/[\])\s]+$/, '').trim()).filter(Boolean)
  if (featParts.length > 1) {
    const mainArtist = featParts[0]
    const guestArtists = featParts.slice(1).flatMap(p =>
      p.split(/\s*[,&]\s*|\s+and\s+/gi).map(a => a.trim()).filter(Boolean)
    )
    return { mainArtist, guestArtists }
  }

  const versusParts = title.split(versusRegex).map(p => p.trim()).filter(Boolean)
  if (versusParts.length > 1) {
    return { mainArtist: versusParts[0], guestArtists: versusParts.slice(1) }
  }

  return { mainArtist: title.trim(), guestArtists: [] }
}
