import type { SalesTransaction } from './ingest/csv-parser'
import { extractFeaturedArtistsDetailed } from './ingest/csv-parser'
import type { GroupByField, GroupNode, FilterState, ArtistCollabNode, ArtistMapping } from './types'

// Re-export all grouping-related types from the canonical types.ts location
export type { GroupByField, GroupNode, FilterState, ArtistCollabNode, ArtistMapping } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFieldValue(tx: SalesTransaction, field: GroupByField): string {
  switch (field) {
    case 'artist':   return tx.main_artist || tx.original_artist || '(unknown)'
    case 'album':    return tx.release_title || '(no album)'
    case 'song':     return tx.track_title || '(no title)'
    case 'platform': return tx.platform || '(no platform)'
    case 'country':  return tx.country || '(no country)'
    case 'month':    return tx.sales_month || '(no month)'
  }
}

// ── Public functions ──────────────────────────────────────────────────────────

/**
 * Groups an array of SalesTransaction by a single field.
 * Returns an array of GroupNode sorted by revenue (descending).
 */
export function groupTransactions(
  transactions: SalesTransaction[],
  groupByField: GroupByField
): GroupNode[] {
  const map = new Map<string, GroupNode>()

  for (const tx of transactions) {
    const key = getFieldValue(tx, groupByField)
    const existing = map.get(key)
    if (existing) {
      existing.revenue += tx.net_revenue
      existing.quantity += tx.quantity
      existing.transactionCount += 1
    } else {
      map.set(key, {
        key,
        label: key,
        revenue: tx.net_revenue,
        quantity: tx.quantity,
        transactionCount: 1,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
}

/**
 * Performs a nested grouping: the first field produces top-level nodes,
 * the remaining fields produce children recursively.
 */
export function nestedGroupTransactions(
  transactions: SalesTransaction[],
  groupByFields: GroupByField[]
): GroupNode[] {
  if (groupByFields.length === 0 || transactions.length === 0) return []

  const [first, ...rest] = groupByFields
  const topLevel = groupTransactions(transactions, first)

  if (rest.length === 0) return topLevel

  // Build a lookup from key → matching transactions
  const txByKey = new Map<string, SalesTransaction[]>()
  for (const tx of transactions) {
    const key = getFieldValue(tx, first)
    const arr = txByKey.get(key)
    if (arr) arr.push(tx)
    else txByKey.set(key, [tx])
  }

  return topLevel.map(node => ({
    ...node,
    children: nestedGroupTransactions(txByKey.get(node.key) ?? [], rest),
  }))
}

/**
 * Returns a new FilterState with all fields set to their empty/default values.
 */
export function defaultFilterState(): FilterState {
  return {
    searchQuery: '',
    selectedPlatforms: [],
    selectedCountries: [],
    selectedSources: [],
    minRevenue: 0,
    maxRevenue: Infinity,
    dateFrom: '',
    dateTo: '',
  }
}

/**
 * Filters a list of SalesTransaction according to the provided FilterState.
 */
export function filterTransactions(
  transactions: SalesTransaction[],
  filter: FilterState
): SalesTransaction[] {
  const q = filter.searchQuery.trim().toLowerCase()
  const maxRev = filter.maxRevenue === Infinity || filter.maxRevenue === 0 ? Infinity : filter.maxRevenue

  return transactions.filter(tx => {
    if (q) {
      const haystack = [
        tx.main_artist,
        tx.original_artist,
        tx.release_title,
        tx.track_title,
        tx.platform,
        tx.country,
      ].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }

    if (filter.selectedPlatforms.length > 0) {
      if (!filter.selectedPlatforms.includes(tx.platform)) return false
    }

    if (filter.selectedCountries.length > 0) {
      if (!filter.selectedCountries.includes(tx.country)) return false
    }

    if (filter.selectedSources.length > 0) {
      if (!filter.selectedSources.includes(tx.source)) return false
    }

    if (filter.minRevenue > 0 && tx.net_revenue < filter.minRevenue) return false
    if (maxRev !== Infinity && tx.net_revenue > maxRev) return false

    if (filter.dateFrom && tx.sales_month && tx.sales_month < filter.dateFrom) return false
    if (filter.dateTo && tx.sales_month && tx.sales_month > filter.dateTo) return false

    return true
  })
}

/** Returns the sorted list of unique platform names from the given transactions. */
export function getAvailablePlatforms(transactions: SalesTransaction[]): string[] {
  const set = new Set<string>()
  for (const tx of transactions) {
    if (tx.platform) set.add(tx.platform)
  }
  return Array.from(set).sort()
}

/** Returns the sorted list of unique country names from the given transactions. */
export function getAvailableCountries(transactions: SalesTransaction[]): string[] {
  const set = new Set<string>()
  for (const tx of transactions) {
    if (tx.country) set.add(tx.country)
  }
  return Array.from(set).sort()
}

/**
 * Builds a collab tree where each primary artist has featuring appearances
 * (collaborations) nested below them.
 *
 * Each transaction's original_artist string is parsed via
 * extractFeaturedArtistsDetailed. If the transaction has a mapping in
 * artistMappings that overrides the primary artist that takes precedence.
 */
export function buildArtistCollabTree(
  transactions: SalesTransaction[],
  artistMappings: ArtistMapping[]
): ArtistCollabNode[] {
  // Build a lookup for fast mapping resolution
  const mappingLookup = new Map<string, string>()
  for (const m of artistMappings) {
    mappingLookup.set(m.featuringName.toLowerCase(), m.primaryArtist)
  }

  // primaryArtist → { revenue, quantity, collabs: Map<name, {revenue, quantity}> }
  const primaryMap = new Map<string, {
    revenue: number
    quantity: number
    collabs: Map<string, { revenue: number; quantity: number }>
  }>()

  const ensurePrimary = (name: string) => {
    if (!primaryMap.has(name)) {
      primaryMap.set(name, { revenue: 0, quantity: 0, collabs: new Map() })
    }
    return primaryMap.get(name)!
  }

  for (const tx of transactions) {
    const rawArtist = tx.original_artist || tx.main_artist || ''
    if (!rawArtist) continue

    const mapped = mappingLookup.get(rawArtist.toLowerCase())
    if (mapped) {
      // Use the mapping: entire revenue goes to primary
      const node = ensurePrimary(mapped)
      node.revenue += tx.net_revenue
      node.quantity += tx.quantity
      continue
    }

    const { primary, featured } = extractFeaturedArtistsDetailed(rawArtist)
    if (!primary) continue

    const resolvedPrimary = mappingLookup.get(primary.toLowerCase()) ?? primary
    const node = ensurePrimary(resolvedPrimary)
    node.revenue += tx.net_revenue
    node.quantity += tx.quantity

    for (const feat of featured) {
      if (!feat) continue
      const existing = node.collabs.get(feat)
      if (existing) {
        existing.revenue += tx.net_revenue
        existing.quantity += tx.quantity
      } else {
        node.collabs.set(feat, { revenue: tx.net_revenue, quantity: tx.quantity })
      }
    }
  }

  return Array.from(primaryMap.entries())
    .map(([primaryArtist, data]) => ({
      primaryArtist,
      revenue: data.revenue,
      quantity: data.quantity,
      collabEntries: Array.from(data.collabs.entries())
        .map(([name, vals]) => ({ name, ...vals }))
        .sort((a, b) => b.revenue - a.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue)
}
