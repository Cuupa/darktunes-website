/**
 * Smart column-mapping suggestions for unknown CSV headers.
 */

import type { FinancialFieldKey } from './types'

const FIELD_SYNONYMS: Record<FinancialFieldKey, string[]> = {
  artistName: ['artist', 'artist name', 'band', 'künstler', 'main artist', 'act', 'interpret'],
  releaseTitle: ['release', 'release title', 'album', 'item name', 'product', 'title'],
  trackTitle: ['track', 'track title', 'song', 'song title'],
  quantity: ['quantity', 'qty', 'units', 'streams', 'downloads', 'anzahl'],
  netRevenue: [
    'net revenue',
    'revenue',
    'net amount',
    'amount you received',
    'earnings',
    'umsatz',
    'netto',
    'sub total',
    'item total',
    'paid to you',
  ],
  currency: ['currency', 'währung', 'curr'],
  salesMonth: [
    'date',
    'sales month',
    'believe sales month',
    'month',
    'period',
    'reporting period',
    'item date',
    'payout date',
    'datum',
  ],
  platform: ['platform', 'store', 'dsp', 'service', 'provider'],
  country: ['country', 'country/region', 'territory', 'land', 'buyer country', 'ship to country'],
  upcEan: ['upc', 'ean', 'barcode', 'gtin'],
  isrc: ['isrc'],
  catalogNumber: ['catalog', 'catalog number', 'cat no', 'release catalog'],
  releaseType: ['release type', 'sales type', 'item type', 'format', 'type'],
  balanceEur: ['balance of revenue share (eur)', 'balance (eur)', 'eur balance'],
  bandcampPackage: ['package'],
}

function normalizeHeader(header: string): string {
  return header.replace(/['"]/g, '').trim().toLowerCase()
}

function scoreHeaderMatch(header: string, synonym: string): number {
  const h = normalizeHeader(header)
  const s = synonym.toLowerCase()
  if (h === s) return 100
  if (h.includes(s) || s.includes(h)) return 80
  const hTokens = new Set(h.split(/[\s_/]+/).filter(Boolean))
  const sTokens = s.split(/[\s_/]+/).filter(Boolean)
  const overlap = sTokens.filter((t) => hTokens.has(t)).length
  if (overlap > 0) return 40 + overlap * 10
  return 0
}

export interface ColumnMappingSuggestions {
  artistName?: string
  netRevenue?: string
  salesMonth?: string
  platform?: string
  country?: string
  quantity?: string
  releaseTitle?: string
}

/**
 * Suggests the best CSV column for each core financial field.
 */
export function suggestColumnMappings(headers: string[]): ColumnMappingSuggestions {
  const suggestions: ColumnMappingSuggestions = {}
  const coreFields: Array<keyof ColumnMappingSuggestions> = [
    'artistName',
    'netRevenue',
    'salesMonth',
    'platform',
    'country',
    'quantity',
    'releaseTitle',
  ]

  for (const field of coreFields) {
    const synonyms = FIELD_SYNONYMS[field as FinancialFieldKey] ?? []
    let bestHeader: string | undefined
    let bestScore = 0

    for (const header of headers) {
      for (const synonym of synonyms) {
        const score = scoreHeaderMatch(header, synonym)
        if (score > bestScore) {
          bestScore = score
          bestHeader = header
        }
      }
    }

    if (bestHeader && bestScore >= 40) {
      suggestions[field] = bestHeader
    }
  }

  return suggestions
}

/**
 * Resolves profile column names against actual CSV headers (exact → contains).
 */
export function resolveProfileColumnsAgainstHeaders(
  columnMapping: Record<string, string | undefined>,
  headers: string[],
): Record<string, string> {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }))
  const resolved: Record<string, string> = {}

  for (const [key, requested] of Object.entries(columnMapping)) {
    if (!requested) continue
    const req = normalizeHeader(requested)
    const exact = normalized.find((h) => h.norm === req)
    if (exact) {
      resolved[key] = exact.raw
      continue
    }
    const contains = normalized.find((h) => h.norm.includes(req) || req.includes(h.norm))
    if (contains) resolved[key] = contains.raw
    else resolved[key] = requested
  }

  return resolved
}