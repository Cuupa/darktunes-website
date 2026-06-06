import type { ArtistMapping } from './types'

/**
 * Jaro-Winkler string similarity (0 = no match, 1 = identical).
 * Replaces the `natural` package dependency which pulled in server-side
 * Node.js modules (mongoose, pg, redis) and caused a 13 MB browser bundle.
 */
function jaroWinklerDistance(s1: string, s2: string): number {
  if (s1 === s2) return 1.0
  const len1 = s1.length
  const len2 = s2.length
  if (len1 === 0 || len2 === 0) return 0.0

  // Jaro match window: characters are considered matching if within floor(max/2)-1
  const matchWindow = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0)
  const s1Matches = new Uint8Array(len1)
  const s2Matches = new Uint8Array(len2)
  let matches = 0

  for (let i = 0; i < len1; i++) {
    const lo = Math.max(0, i - matchWindow)
    const hi = Math.min(i + matchWindow + 1, len2)
    for (let j = lo; j < hi; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = 1
      s2Matches[j] = 1
      matches++
      break
    }
  }

  if (matches === 0) return 0.0

  let k = 0
  let transpositions = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  const jaro =
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3

  // Winkler prefix bonus: reward strings that share a common prefix (up to 4 chars).
  // The scaling factor 0.1 is the standard Winkler constant (p = 0.1).
  const WINKLER_SCALING_FACTOR = 0.1
  let prefix = 0
  const prefixLimit = Math.min(4, Math.min(len1, len2))
  for (let i = 0; i < prefixLimit; i++) {
    if (s1[i] === s2[i]) prefix++
    else break
  }

  return jaro + prefix * WINKLER_SCALING_FACTOR * (1 - jaro)
}

/**
 * Generates automatic artist mappings using Jaro-Winkler similarity.
 *
 * For every unique artist from the CSV that:
 *   - is not already covered by an existing manual mapping, and
 *   - scores > 0.85 against a known primary artist name
 *
 * …a mapping entry is created with autoMapped = true.
 * These are displayed in the UI as suggestions but do NOT feed back
 * into the worker config (to avoid resolution loops).
 */
export function computeAutoMappings(
  uniqueArtists: string[],
  existingMappings: ArtistMapping[]
): ArtistMapping[] {
  const existingKeys = new Set(existingMappings.map(m => m.featuringName.toLowerCase()))
  const primaryArtists = Array.from(new Set(existingMappings.map(m => m.primaryArtist)))

  if (primaryArtists.length === 0) return []

  // Pre-compute lowercase primaries to avoid repeated conversion in the inner loop
  const primaryArtistsLower = primaryArtists.map(p => p.toLowerCase())

  const result: ArtistMapping[] = []

  for (const artist of uniqueArtists) {
    const artistLower = artist.toLowerCase()
    if (existingKeys.has(artistLower)) continue
    if (primaryArtistsLower.some(p => p === artistLower)) continue

    let bestScore = 0
    let bestPrimary = ''

    for (let i = 0; i < primaryArtists.length; i++) {
      const score = jaroWinklerDistance(artistLower, primaryArtistsLower[i])
      if (score > bestScore) {
        bestScore = score
        bestPrimary = primaryArtists[i]
      }
    }

    if (bestScore > 0.85 && bestPrimary) {
      result.push({
        id: `auto-${artist}`,
        featuringName: artist,
        primaryArtist: bestPrimary,
        autoMapped: true,
        mappingScore: parseFloat(bestScore.toFixed(4)),
      })
    }
  }

  return result
}
