/**
 * src/lib/sync/deduplication.ts
 *
 * Release deduplication utility.
 *
 * Merges digital (Spotify) and physical (Discogs) releases using barcode/UPC
 * as the canonical deduplication key.
 *
 * Matching strategy (in order of precedence):
 *   1. Barcode/UPC match (exact, digits only)
 *   2. Normalized title + approximate year match (fuzzy fallback)
 *
 * Note: Discogs does not provide ISRCs, so ISRC-based matching is not possible
 * here. ISRC matching is available in findCrossSourceMergeTarget for DB rows.
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

export interface CrossSourceReleaseRow {
  id: string
  title: string
  release_date: string
  spotify_id: string | null
  itunes_id: string | null
  discogs_id?: string | null
  isrc?: string | null
  barcode?: string | null
}

export type ExternalReleaseSource = 'itunes' | 'spotify' | 'discogs'

export interface IncomingReleaseMatchFields {
  title: string
  releaseDate: string
  isrc?: string | null
  barcode?: string | null
}

/** Keeps the per-artist in-memory release list current within a single sync run. */
export function registerSyncedRelease(
  existingReleases: CrossSourceReleaseRow[],
  row: {
    id: string
    title: string
    release_date: string
    spotify_id?: string | null
    itunes_id?: string | null
    discogs_id?: string | null
    isrc?: string | null
    barcode?: string | null
  },
  merged: boolean,
): void {
  if (merged) {
    const target = existingReleases.find((r) => r.id === row.id)
    if (!target) return
    if (row.spotify_id) target.spotify_id = row.spotify_id
    if (row.itunes_id) target.itunes_id = row.itunes_id
    if (row.discogs_id) target.discogs_id = row.discogs_id
    if (row.isrc) target.isrc = row.isrc
    if (row.barcode) target.barcode = row.barcode
    target.title = row.title
    target.release_date = row.release_date
    return
  }

  const duplicate = existingReleases.some((r) => r.id === row.id)
  if (duplicate) return

  existingReleases.push({
    id: row.id,
    title: row.title,
    release_date: row.release_date,
    spotify_id: row.spotify_id ?? null,
    itunes_id: row.itunes_id ?? null,
    discogs_id: row.discogs_id ?? null,
    isrc: row.isrc ?? null,
    barcode: row.barcode ?? null,
  })
}

/** Normalise a title for fuzzy comparison: strip streaming suffixes, lowercase, strip punctuation */
export function normTitle(title: string): string {
  return title
    .toLowerCase()
    // Strip common streaming/iTunes suffixes like " - EP", " - Single", " - Album", " - LP"
    // so that "Nocturnal - EP" (iTunes) matches "Nocturnal" (manually entered).
    .replace(/\s+-\s+(ep|single|album|lp|maxi single|maxi)\s*$/, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extract YYYY from an ISO date string (YYYY-MM-DD or YYYY) */
export function extractYear(date: string | null): number | null {
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

    // 1. Barcode match
    if (spotify.barcode) {
      bestDiscogs =
        discogsReleases.find(
          (d) => d.barcode && d.barcode.replace(/\D/g, '') === spotify.barcode!.replace(/\D/g, ''),
        ) ?? null
    }

    // 2. Fuzzy title + year match
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

function normalizeBarcode(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

/**
 * Finds an existing release row that likely represents the same album as an
 * incoming sync item (ISRC/barcode, then title + approximate year).
 * Includes manual entries without external IDs.
 */
export function findCrossSourceMergeTarget(
  existingReleases: CrossSourceReleaseRow[],
  incoming: IncomingReleaseMatchFields,
  source: ExternalReleaseSource,
): CrossSourceReleaseRow | null {
  const incomingYear = extractYear(incoming.releaseDate)
  const incomingNorm = normTitle(incoming.title)
  const incomingIsrc = incoming.isrc?.trim() || null
  const incomingBarcode = normalizeBarcode(incoming.barcode)

  for (const row of existingReleases) {
    if (source === 'itunes' && row.itunes_id) continue
    if (source === 'spotify' && row.spotify_id) continue
    if (source === 'discogs' && row.discogs_id) continue

    if (incomingIsrc && row.isrc && incomingIsrc === row.isrc.trim()) return row

    const rowBarcode = normalizeBarcode(row.barcode)
    if (incomingBarcode && rowBarcode && incomingBarcode === rowBarcode) return row

    const rowYear = extractYear(row.release_date)
    const titleMatch = normTitle(row.title) === incomingNorm
    const yearMatch =
      incomingYear !== null && rowYear !== null
        ? Math.abs(incomingYear - rowYear) <= 1
        : titleMatch

    if (titleMatch && yearMatch) return row
  }

  return null
}


