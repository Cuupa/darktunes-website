/**
 * src/lib/slugify.ts
 *
 * Single source of truth for slug generation.
 * Used by ArtistForm, NewsForm, and artistRowMapper — must stay identical
 * across all call sites so artists without a stored slug get the same URL
 * everywhere.
 *
 * Transformation order:
 *   1. German umlaut expansion (ä→ae, ö→oe, ü→ue, ß→ss, incl. uppercase)
 *   2. NFKD normalisation + strip combining diacritical marks
 *   3. Lowercase
 *   4. Replace any run of non-alphanumeric characters with a single hyphen
 *   5. Trim leading / trailing hyphens
 */
export function toSlug(text: string): string {
  return text
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'ae')
    .replace(/Ö/g, 'oe')
    .replace(/Ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
