/**
 * Normalises territory / venue country strings for cross-source matching.
 */

const COUNTRY_ALIASES: Record<string, string> = {
  'united states': 'United States',
  usa: 'United States',
  us: 'United States',
  'united kingdom': 'United Kingdom',
  uk: 'United Kingdom',
  gb: 'United Kingdom',
  deutschland: 'Germany',
  de: 'Germany',
  germany: 'Germany',
  österreich: 'Austria',
  oesterreich: 'Austria',
  at: 'Austria',
  austria: 'Austria',
  schweiz: 'Switzerland',
  ch: 'Switzerland',
  switzerland: 'Switzerland',
  polska: 'Poland',
  pl: 'Poland',
  poland: 'Poland',
  nederland: 'Netherlands',
  nl: 'Netherlands',
  netherlands: 'Netherlands',
  france: 'France',
  fr: 'France',
  italia: 'Italy',
  it: 'Italy',
  italy: 'Italy',
  españa: 'Spain',
  spain: 'Spain',
  es: 'Spain',
}

export function normalizeCountryName(raw: string | null | undefined): string {
  if (!raw?.trim()) return ''
  const trimmed = raw.trim()
  const key = trimmed.toLowerCase()
  return COUNTRY_ALIASES[key] ?? trimmed
}

export function countriesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeCountryName(a).toLowerCase()
  const nb = normalizeCountryName(b).toLowerCase()
  if (!na || !nb) return false
  return na === nb
}