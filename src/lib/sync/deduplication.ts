/**
 * src/lib/sync/deduplication.ts
 *
 * Release deduplication utility.
 *
 * Merges digital (Spotify) and physical (Discogs) releases using ISRC or
 * barcode/UPC as the canonical deduplication key.
 *
 * Matching strategy (in order of precedence):
 *   1. ISRC match (exact)
 *   2. Barcode/UPC match (exact)
 *   3. Normalized title + approximate year match (fuzzy fallback)
 *
 * The result is a merged release record ready for UPSERT into Supabase.
 */

// ---------------------------------------------------------------------------
// Input types (from API integration modules)
// ---------------------------------------------------------------------------

export interface SpotifyReleaseInput {
  spotifyId: string
  title: string
  type: 'album' | 'ep' | 'single'
  releaseDate: string
  coverUrl: string | null
  spotifyUrl: string
  popularity: number | null
  barcode: string | null
  isrc: string | null
}

export interface DiscogsReleaseInput {
  discogsId: string
  title: string
  artistName: string
  releaseDate: string | null
  coverUrl: string | null
  catalogNumber: string | null
  barcode: string | null
  format: 'vinyl' | 'cd' | 'digital' | 'other'
}

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface MergedRelease {
  /** Primary deduplication key: Spotify ID if available */
  spotifyId: string | null
  discogsId: string | null
  title: string
  type: 'album' | 'ep' | 'single'
  releaseDate: string
  coverUrl: string | null
  spotifyUrl: string | null
  popularity: number | null
  /** Barcode / UPC from Spotify or Discogs */
  barcode: string | null
  isrc: string | null
  catalogNumber: string | null
  /** True when a Spotify release was matched to a Discogs release */
  merged: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise a title for fuzzy comparison: lowercase, strip punctuation */
function normTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extract YYYY from an ISO date string (YYYY-MM-DD or YYYY) */
function extractYear(date: string | null): number | null {
  if (!date) return null
  const m = /^(\d{4})/.exec(date)
  return m ? parseInt(m[1], 10) : null
}

// ---------------------------------------------------------------------------
// Core deduplication
// ---------------------------------------------------------------------------

/**
 * Deduplicates and merges Spotify + Discogs release lists.
 *
 * Spotify releases are used as the primary source; Discogs releases enrich
 * them with catalog numbers and barcodes. Unmatched Discogs releases are
 * included as standalone entries.
 */
export function deduplicateReleases(
  spotifyReleases: SpotifyReleaseInput[],
  discogsReleases: DiscogsReleaseInput[],
): MergedRelease[] {
  const merged: MergedRelease[] = []
  const matchedDiscogsIds = new Set<string>()

  for (const spotify of spotifyReleases) {
    let bestDiscogs: DiscogsReleaseInput | null = null

    // 1. ISRC match
    if (spotify.isrc) {
      bestDiscogs = discogsReleases.find((d) => d.barcode === spotify.isrc) ?? null
    }

    // 2. Barcode match
    if (!bestDiscogs && spotify.barcode) {
      bestDiscogs =
        discogsReleases.find(
          (d) => d.barcode && d.barcode.replace(/\D/g, '') === spotify.barcode!.replace(/\D/g, ''),
        ) ?? null
    }

    // 3. Fuzzy title + year match
    if (!bestDiscogs) {
      const spotifyYear = extractYear(spotify.releaseDate)
      const spotifyNorm = normTitle(spotify.title)
      bestDiscogs =
        discogsReleases.find((d) => {
          if (matchedDiscogsIds.has(d.discogsId)) return false
          const discogsYear = extractYear(d.releaseDate)
          const titleMatch = normTitle(d.title) === spotifyNorm
          const yearMatch = spotifyYear !== null && discogsYear !== null
            ? Math.abs(spotifyYear - discogsYear) <= 1
            : true
          return titleMatch && yearMatch
        }) ?? null
    }

    if (bestDiscogs) matchedDiscogsIds.add(bestDiscogs.discogsId)

    merged.push({
      spotifyId: spotify.spotifyId,
      discogsId: bestDiscogs?.discogsId ?? null,
      title: spotify.title,
      type: spotify.type,
      releaseDate: spotify.releaseDate,
      coverUrl: spotify.coverUrl,
      spotifyUrl: spotify.spotifyUrl,
      popularity: spotify.popularity,
      barcode: spotify.barcode ?? bestDiscogs?.barcode ?? null,
      isrc: spotify.isrc,
      catalogNumber: bestDiscogs?.catalogNumber ?? null,
      merged: bestDiscogs !== null,
    })
  }

  // Include Discogs-only releases (no Spotify match found)
  for (const discogs of discogsReleases) {
    if (matchedDiscogsIds.has(discogs.discogsId)) continue
    merged.push({
      spotifyId: null,
      discogsId: discogs.discogsId,
      title: discogs.title,
      type: 'album',
      releaseDate: discogs.releaseDate ?? '1970-01-01',
      coverUrl: discogs.coverUrl,
      spotifyUrl: null,
      popularity: null,
      barcode: discogs.barcode,
      isrc: null,
      catalogNumber: discogs.catalogNumber,
      merged: false,
    })
  }

  return merged
}
