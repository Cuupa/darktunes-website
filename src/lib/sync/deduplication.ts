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

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

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

export type ReleaseSyncPolicy = 'auto' | 'manual_until_street' | 'locked'

export interface CrossSourceReleaseRow {
  id: string
  title: string
  release_date: string
  spotify_id: string | null
  itunes_id: string | null
  discogs_id?: string | null
  isrc?: string | null
  barcode?: string | null
  /** When omitted, treated as auto (legacy rows). */
  sync_policy?: ReleaseSyncPolicy | null
}

/**
 * True when external sync must not fuzzy-merge onto this row.
 * - locked: never
 * - manual_until_street: until calendar release_date (inclusive of today = open)
 * - auto: never protected by policy alone
 */
export function isReleaseSyncProtected(
  row: Pick<CrossSourceReleaseRow, 'release_date' | 'sync_policy'>,
  now: Date = new Date(),
): boolean {
  const policy = row.sync_policy ?? 'auto'
  if (policy === 'locked') return true
  if (policy !== 'manual_until_street') return false

  // Compare date-only in UTC to avoid timezone flip near midnight
  const street = row.release_date.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(street)) return true
  const today = now.toISOString().slice(0, 10)
  return street > today
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
    sync_policy?: ReleaseSyncPolicy | null
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
    if (row.sync_policy) target.sync_policy = row.sync_policy
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
    sync_policy: row.sync_policy ?? 'auto',
  })
}

/**
 * Strips iTunes/streaming type suffixes from a release title.
 * e.g. "Darkwalker - Single" → "Darkwalker"
 *      "Otherside - EP"      → "Otherside"
 * Case-insensitive. Does NOT lowercase or strip punctuation (use normTitle for comparisons).
 */
export function stripReleaseSuffix(title: string): string {
  return title.replace(/\s+-\s+(ep|single|album|lp|maxi single|maxi)\s*$/i, '').trim()
}

/** Normalise a title for fuzzy comparison: strip streaming suffixes, lowercase, strip punctuation */
export function normTitle(title: string): string {
  return stripReleaseSuffix(title)
    .toLowerCase()
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

  const spotifyGroups = new Map<string, MergedRelease[]>()
  for (const release of merged) {
    if (!release.spotifyId) continue
    const releaseYear = extractYear(release.releaseDate)
    if (releaseYear === null) continue

    const key = `${normTitle(release.title)}::${releaseYear}`
    const group = spotifyGroups.get(key)
    if (group) {
      group.push(release)
    } else {
      spotifyGroups.set(key, [release])
    }
  }

  const primaryBySpotifyId = new Map<string, MergedRelease>()
  const discardedSpotifyIds = new Set<string>()

  for (const group of spotifyGroups.values()) {
    if (group.length <= 1) continue

    const primary = group.reduce((best, candidate) => {
      const bestPopularity = best.popularity ?? -1
      const candidatePopularity = candidate.popularity ?? -1
      if (candidatePopularity !== bestPopularity) {
        return candidatePopularity > bestPopularity ? candidate : best
      }

      return candidate.title.length < best.title.length ? candidate : best
    })

    const mergedPrimary = { ...primary, merged: true }

    for (const candidate of group) {
      if (candidate.spotifyId === primary.spotifyId) continue

      discardedSpotifyIds.add(candidate.spotifyId!)
      mergedPrimary.discogsId ??= candidate.discogsId
      mergedPrimary.barcode ??= candidate.barcode
      mergedPrimary.catalogNumber ??= candidate.catalogNumber
    }

    primaryBySpotifyId.set(primary.spotifyId!, mergedPrimary)
  }

  return merged.flatMap((release) => {
    if (!release.spotifyId) return [release]
    if (discardedSpotifyIds.has(release.spotifyId)) return []
    return [primaryBySpotifyId.get(release.spotifyId) ?? release]
  })
}

/**
 * Returns `true` when a release row carries no external IDs — i.e. it was
 * created manually (e.g. as a pre-release placeholder) and has never been
 * enriched by any sync source.
 */
export function isManualRow(row: CrossSourceReleaseRow): boolean {
  return !row.spotify_id && !row.itunes_id && !row.discogs_id
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
    if (isReleaseSyncProtected(row)) continue
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

  if (source !== 'spotify') return null

  for (const row of existingReleases) {
    const sameSourceId =
      row.spotify_id

    if (!sameSourceId) continue

    const rowYear = extractYear(row.release_date)
    if (incomingYear === null || rowYear === null || incomingYear !== rowYear) continue
    if (normTitle(row.title) !== incomingNorm) continue

    return row
  }

  return null
}

// ---------------------------------------------------------------------------
// DB-level deduplication (prune existing duplicates)
// ---------------------------------------------------------------------------

type PruneExtraRow = {
  id: string
  popularity: number | null
  catalog_number: string | null
  featured: boolean | null
}

/**
 * Collapses duplicate DB rows for one artist that share the same normalised
 * title and release year.
 *
 * For each duplicate group the canonical row is elected with this priority:
 *   1. Row with a `spotify_id` beats rows without one.
 *   2. Among rows with `spotify_id`, higher `popularity` wins.
 *   3. Tie-breaker: shorter title (simpler title = manually entered base entry).
 *
 * Non-canonical rows are merged into the canonical row (filling only `null`
 * fields) and then deleted from the database. Rows with `featured = true`
 * are never deleted.
 *
 * @returns Counts of rows merged and deleted.
 */
export async function pruneOrphanedDuplicates(
  db: SupabaseClient<Database>,
  _artistId: string,
  existingReleases: CrossSourceReleaseRow[],
): Promise<{ merged: number; deleted: number }> {
  let mergedCount = 0
  let deletedCount = 0

  // Group by normalised title + release year (same key used in deduplicateReleases)
  const groups = new Map<string, CrossSourceReleaseRow[]>()
  for (const row of existingReleases) {
    const year = extractYear(row.release_date)
    if (year === null) continue
    const key = `${normTitle(row.title)}::${year}`
    const group = groups.get(key)
    if (group) {
      group.push(row)
    } else {
      groups.set(key, [row])
    }
  }

  for (const group of groups.values()) {
    if (group.length <= 1) continue

    const groupIds = group.map((r) => r.id)

    // Fetch popularity, catalog_number, and featured flag in one round-trip.
    // popularity  → canonical election
    // catalog_number → enrichment merge
    // featured    → deletion guard
    const { data: extraRows } = await db
      .from('releases')
      .select('id, popularity, catalog_number, featured')
      .in('id', groupIds)

    const extraMap = new Map<string, PruneExtraRow>(
      ((extraRows ?? []) as PruneExtraRow[]).map((r) => [r.id, r]),
    )

    // Elect the canonical row
    const withSpotify = group.filter((r) => r.spotify_id)
    const candidatePool = withSpotify.length > 0 ? withSpotify : group

    const canonical = candidatePool.reduce((best, candidate) => {
      const bestPop = extraMap.get(best.id)?.popularity ?? -1
      const candidatePop = extraMap.get(candidate.id)?.popularity ?? -1
      if (candidatePop !== bestPop) return candidatePop > bestPop ? candidate : best
      return candidate.title.length < best.title.length ? candidate : best
    })

    const nonCanonical = group.filter((r) => r.id !== canonical.id)
    const canonicalExtra = extraMap.get(canonical.id)

    // Build a patch for the canonical row by filling null fields from non-canonical rows
    const patch: Database['public']['Tables']['releases']['Update'] = {}
    for (const nc of nonCanonical) {
      const ncExtra = extraMap.get(nc.id)
      if (ncExtra?.featured) continue // featured rows are skipped entirely

      if (!canonical.discogs_id && nc.discogs_id) patch.discogs_id ??= nc.discogs_id
      if (!canonical.itunes_id && nc.itunes_id) patch.itunes_id ??= nc.itunes_id
      if (!canonical.isrc && nc.isrc) patch.isrc ??= nc.isrc
      if (!canonical.barcode && nc.barcode) patch.barcode ??= nc.barcode
      if (!canonicalExtra?.catalog_number && ncExtra?.catalog_number) {
        patch.catalog_number ??= ncExtra.catalog_number
      }
    }

    // Apply the merged patch to the canonical row (best-effort)
    if (Object.keys(patch).length > 0) {
      await db.from('releases').update(patch).eq('id', canonical.id)
      mergedCount++
    }

    // Delete non-canonical rows, skipping any that are featured
    const toDelete = nonCanonical.filter((r) => !extraMap.get(r.id)?.featured)
    if (toDelete.length > 0) {
      await db
        .from('releases')
        .delete()
        .in(
          'id',
          toDelete.map((r) => r.id),
        )
      deletedCount += toDelete.length
    }
  }

  return { merged: mergedCount, deleted: deletedCount }
}
