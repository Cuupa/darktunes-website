import type { ArtistMapping } from './types'

/** A release identified as a potential compilation by the heuristic engine. */
export interface CompilationDetectionResult {
  releaseTitle: string
  upcEan: string
  catalogNumber: string
  uniqueArtistCount: number
  /** Human-readable reasons why this release was flagged. */
  reasons: string[]
  confidence: 'high' | 'medium' | 'low'
}

/** Thresholds used by the heuristic. All fields optional with sensible defaults. */
export interface CompilationDetectionOptions {
  /** Minimum distinct artist count to consider a release a compilation. Default: 3. */
  minArtistCount?: number
  /** Artist count threshold for 'high' confidence (via artist count alone). Default: 5. */
  highConfidenceArtistCount?: number
  /** Artist mappings used to resolve featured/alias artist names before counting. */
  artistMappings?: ArtistMapping[]
}

/** Title keywords that are typical of compilation releases (case-insensitive match). */
const COMPILATION_KEYWORDS = [
  'compilation',
  'various artists',
  'various',
  'v.a.',
  'sampler',
  'best of',
  'greatest hits',
  'soundtrack',
] as const

/**
 * A minimal representation of a transaction used by the heuristic.
 * Matches the fields available on `SalesTransaction` from the CSV parser.
 */
export interface HeuristicTransaction {
  release_title: string
  upc_ean: string
  catalog_number: string
  main_artist: string
}

/**
 * Resolves an artist name through the provided mappings (alias → primary).
 * Falls back to the original name when no mapping is found.
 *
 * Uses a pre-built Map for O(1) lookup to avoid quadratic complexity when
 * iterating over many transactions.
 */
function buildMappingLookup(mappings: ArtistMapping[]): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const m of mappings) {
    lookup.set(m.featuringName.toLowerCase(), m.primaryArtist)
  }
  return lookup
}

function resolveArtist(name: string, lookup: Map<string, string>): string {
  return lookup.get(name.toLowerCase()) ?? name
}

/**
 * Detects releases that are likely compilations based on artist-diversity and
 * title-keyword heuristics.
 *
 * ### Heuristic rules
 * 1. **Artist diversity** – a release with `>= minArtistCount` distinct main
 *    artists is flagged.  Confidence is `high` when `>= highConfidenceArtistCount`,
 *    otherwise `medium`.
 * 2. **Title keyword match** – when the release title (case-insensitive) contains
 *    any of the standard compilation keywords the release is flagged with
 *    confidence `low` (unless promoted by rule 1).
 * 3. **Both rules match** → confidence is always `high`.
 *
 * The function is pure and has no side effects; it can safely be called inside a
 * `useMemo` without performance concerns for typical label-sized datasets.
 *
 * @param transactions - Flat list of sales transactions (SalesTransaction or
 *   compatible subset).
 * @param options - Optional configuration for thresholds and artist mappings.
 * @returns Sorted array of detection results (high confidence first).
 */
export function detectCompilationCandidates(
  transactions: HeuristicTransaction[],
  options: CompilationDetectionOptions = {}
): CompilationDetectionResult[] {
  const {
    minArtistCount = 3,
    highConfidenceArtistCount = 5,
    artistMappings = [],
  } = options

  // Pre-build mapping lookup for O(1) alias resolution during transaction iteration.
  const mappingLookup = buildMappingLookup(artistMappings)

  // Group transactions by a normalised release key (upc_ean > catalog_number > title).
  // Transactions with all three fields empty are skipped (no meaningful key).
  type ReleaseAccumulator = {
    releaseTitle: string
    upcEan: string
    catalogNumber: string
    artists: Set<string>
  }

  const releaseMap = new Map<string, ReleaseAccumulator>()

  for (const tx of transactions) {
    const key = (tx.upc_ean || tx.catalog_number || tx.release_title || '').toLowerCase()
    if (!key) continue

    const existing = releaseMap.get(key)
    const resolvedArtist = resolveArtist(tx.main_artist, mappingLookup)

    if (existing) {
      existing.artists.add(resolvedArtist)
    } else {
      releaseMap.set(key, {
        releaseTitle: tx.release_title || '',
        upcEan: tx.upc_ean || '',
        catalogNumber: tx.catalog_number || '',
        artists: new Set([resolvedArtist]),
      })
    }
  }

  const results: CompilationDetectionResult[] = []

  for (const acc of releaseMap.values()) {
    const uniqueArtistCount = acc.artists.size
    const titleLower = acc.releaseTitle.toLowerCase()

    const matchedKeyword = COMPILATION_KEYWORDS.find(kw => titleLower.includes(kw))

    const artistCriteriaMet = uniqueArtistCount >= minArtistCount
    const keywordCriteriaMet = matchedKeyword !== undefined

    if (!artistCriteriaMet && !keywordCriteriaMet) continue

    const reasons: string[] = []

    if (artistCriteriaMet) {
      reasons.push(`${uniqueArtistCount} distinct artists`)
    }
    if (keywordCriteriaMet) {
      reasons.push(`Title contains "${matchedKeyword}"`)
    }

    let confidence: CompilationDetectionResult['confidence']
    if (artistCriteriaMet && keywordCriteriaMet) {
      confidence = 'high'
    } else if (artistCriteriaMet) {
      confidence = uniqueArtistCount >= highConfidenceArtistCount ? 'high' : 'medium'
    } else {
      // keyword-only
      confidence = 'low'
    }

    results.push({
      releaseTitle: acc.releaseTitle,
      upcEan: acc.upcEan,
      catalogNumber: acc.catalogNumber,
      uniqueArtistCount,
      reasons,
      confidence,
    })
  }

  // Sort: high → medium → low, then alphabetically by title.
  const confidenceOrder: Record<CompilationDetectionResult['confidence'], number> = {
    high: 0,
    medium: 1,
    low: 2,
  }

  return results.sort((a, b) => {
    const diff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence]
    if (diff !== 0) return diff
    return a.releaseTitle.localeCompare(b.releaseTitle)
  })
}

/**
 * Builds a flat list of `HeuristicTransaction` objects from the release
 * breakdown of each processed artist.  This is the canonical input shape for
 * `detectCompilationCandidates` when called from `App.tsx`.
 *
 * Separating this mapping from `App.tsx` keeps the data contract in one place
 * and makes the transformation independently testable.
 *
 * @param processedData - Array of processed artist data from `useCSVProcessor`.
 */
export function buildHeuristicTransactions(
  processedData: ReadonlyArray<{
    artist: string
    releaseBreakdown: ReadonlyArray<{
      releaseTitle: string
      upcEan: string
      catalogNumber: string
    }>
  }>
): HeuristicTransaction[] {
  return processedData.flatMap(d =>
    d.releaseBreakdown.map(r => ({
      release_title: r.releaseTitle,
      upc_ean: r.upcEan,
      catalog_number: r.catalogNumber,
      main_artist: d.artist,
    }))
  )
}
