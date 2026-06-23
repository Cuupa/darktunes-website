/**
 * src/lib/sync/syncArtist.ts
 *
 * Core artist sync orchestrator following the Inversion of Control (IoC) pattern.
 * All external dependencies are injected via SyncDeps — making this fully testable
 * without any real HTTP calls or R2 uploads.
 *
 * Flow:
 *   1. Fetch artist row from DB
 *   2. Fetch releases from iTunes API (with exponential backoff)
 *   3. For each release (parallel, concurrency 5): upsert/merge to DB → cache cover art in R2 → update cover_art
 *   4. Update artist's last_synced_at timestamp
 *   5. Write a sync_log entry (success / partial / error) unless skipSyncLog is set
 *   6. Return SyncResult — never throws; all errors are captured in SyncResult.errors
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { withExponentialBackoff } from '@/lib/rateLimiter'
import { searchItunesArtist } from '@/lib/itunesApi'
import { upsertReleaseByItunesId } from '@/lib/api/releases'
import { mapWithConcurrency } from '@/lib/mapWithConcurrency'
import {
  findCrossSourceMergeTarget,
  type CrossSourceReleaseRow,
} from '@/lib/sync/deduplication'

const RELEASE_SYNC_CONCURRENCY = 5

export interface SyncDeps {
  /** Supabase client with service-role access for writes */
  db: SupabaseClient<Database>
  /** Injectable fetch — real in production, mocked in tests */
  fetch: typeof fetch
  /**
   * Uploads an image from `imageUrl` to R2 and returns the public CDN URL.
   * Receives a `keyPrefix` (e.g. 'cover-art') to organise objects in the bucket.
   */
  uploadToR2: (imageUrl: string, keyPrefix: string) => Promise<string>
  /** When true, skips the per-artist sync_logs insert (used when called from syncAll). */
  skipSyncLog?: boolean
}

export interface SyncResult {
  artistId: string
  releasesUpserted: number
  errors: string[]
}

interface ReleaseProcessOutcome {
  upserted: boolean
  merged: boolean
  errors: string[]
}

function deriveReleaseType(trackCount: number): 'single' | 'ep' | 'album' {
  if (trackCount === 1) return 'single'
  if (trackCount <= 6) return 'ep'
  return 'album'
}

/**
 * Extracts the numeric iTunes artist ID from an Apple Music URL.
 * e.g. "https://music.apple.com/us/artist/name/1234567890" → "1234567890"
 * Returns null when the URL is not an Apple Music artist URL.
 */
function extractItunesArtistId(appleMusicUrl: string | null | undefined): string | null {
  if (!appleMusicUrl) return null
  const match = appleMusicUrl.match(/\/artist\/[^/]+\/(\d+)(?:[?#].*)?$/)
  return match?.[1] ?? null
}

async function cacheCoverArt(
  db: SupabaseClient<Database>,
  uploadToR2: SyncDeps['uploadToR2'],
  releaseId: string,
  releaseTitle: string,
  artworkUrl: string | undefined,
  releaseErrors: string[],
): Promise<void> {
  if (!artworkUrl) return

  try {
    const coverArt = await uploadToR2(artworkUrl, 'cover-art')
    await db.from('releases').update({ cover_art: coverArt }).eq('id', releaseId)
  } catch (uploadErr) {
    releaseErrors.push(
      `Cover art upload failed for "${releaseTitle}": ${
        uploadErr instanceof Error ? uploadErr.message : String(uploadErr)
      }`,
    )
  }
}

async function processItunesRelease(
  release: Awaited<ReturnType<typeof searchItunesArtist>>[number],
  artistId: string,
  deps: SyncDeps,
  existingReleases: CrossSourceReleaseRow[],
): Promise<ReleaseProcessOutcome> {
  const { db, uploadToR2 } = deps
  const releaseErrors: string[] = []
  const artworkUrl = release.artworkUrl600 ?? release.artworkUrl100
  const releaseDate = release.releaseDate.split('T')[0]
  const itunesId = String(release.collectionId)

  try {
    const mergeTarget = findCrossSourceMergeTarget(
      existingReleases,
      release.collectionName,
      releaseDate,
    )

    if (mergeTarget) {
      const { error: mergeErr } = await db
        .from('releases')
        .update({
          itunes_id: itunesId,
          apple_music_url: release.collectionViewUrl,
          ...(artworkUrl ? { cover_art: artworkUrl } : {}),
        })
        .eq('id', mergeTarget.id)

      if (mergeErr) throw new Error(mergeErr.message)

      mergeTarget.itunes_id = itunesId
      await cacheCoverArt(db, uploadToR2, mergeTarget.id, release.collectionName, artworkUrl, releaseErrors)

      return { upserted: true, merged: true, errors: releaseErrors }
    }

    const upsertedRelease = await upsertReleaseByItunesId(db, {
      title: release.collectionName,
      artist_id: artistId,
      release_date: releaseDate,
      cover_art: artworkUrl ?? null,
      type: deriveReleaseType(release.trackCount),
      apple_music_url: release.collectionViewUrl,
      itunes_id: itunesId,
      featured: false,
    })

    await cacheCoverArt(db, uploadToR2, upsertedRelease.id, release.collectionName, artworkUrl, releaseErrors)

    return { upserted: true, merged: false, errors: releaseErrors }
  } catch (err) {
    return {
      upserted: false,
      merged: false,
      errors: [
        `Failed to upsert "${release.collectionName}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      ],
    }
  }
}

/**
 * Syncs one artist: fetches releases from iTunes, caches cover art in R2,
 * upserts releases to Supabase, and writes a sync_logs entry.
 *
 * This function never throws — errors are captured and returned in SyncResult.
 */
export async function syncArtist(artistId: string, deps: SyncDeps): Promise<SyncResult> {
  const startedAt = Date.now()
  const { db, fetch: fetchFn, skipSyncLog } = deps
  const errors: string[] = []
  let releasesUpserted = 0
  let releasesMerged = 0

  // 1. Fetch artist from DB
  const { data: artistRow, error: artistErr } = await db
    .from('artists')
    .select('id, name, apple_music_url')
    .eq('id', artistId)
    .single()

  if (artistErr || !artistRow) {
    const msg = artistErr?.message ?? 'Artist not found'
    return { artistId, releasesUpserted: 0, errors: [msg] }
  }

  const itunesArtistId = extractItunesArtistId(artistRow.apple_music_url)

  const { data: existingReleaseRows } = await db
    .from('releases')
    .select('id, title, release_date, spotify_id, itunes_id')
    .eq('artist_id', artistId)

  const existingReleases: CrossSourceReleaseRow[] = (existingReleaseRows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    release_date: row.release_date,
    spotify_id: row.spotify_id,
    itunes_id: row.itunes_id,
  }))

  // 2. Fetch iTunes releases with exponential backoff
  let itunesReleases: Awaited<ReturnType<typeof searchItunesArtist>> = []
  try {
    itunesReleases = await withExponentialBackoff(() =>
      searchItunesArtist(artistRow.name, fetchFn, itunesArtistId ?? undefined),
    )
  } catch (err) {
    errors.push(`iTunes fetch failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 3. Process releases in parallel (bounded concurrency)
  const outcomes = await mapWithConcurrency(
    itunesReleases,
    RELEASE_SYNC_CONCURRENCY,
    (release) => processItunesRelease(release, artistId, deps, existingReleases),
  )

  for (const outcome of outcomes) {
    if (outcome.status === 'rejected') {
      errors.push(`Release processing failed: ${String(outcome.reason)}`)
      continue
    }
    errors.push(...outcome.value.errors)
    if (outcome.value.upserted) releasesUpserted++
    if (outcome.value.merged) releasesMerged++
  }

  // 4. Update artist's last_synced_at (best-effort, ignore errors)
  await db
    .from('artists')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', artistId)

  // 5. Write sync_log entry (skipped when syncAll writes an aggregate log)
  if (!skipSyncLog) {
    const status: 'success' | 'partial' | 'error' =
      errors.length === 0 ? 'success' : releasesUpserted > 0 ? 'partial' : 'error'

    await db.from('sync_logs').insert({
      artist_id: artistId,
      status,
      message: errors[0] ?? null,
      releases_synced: releasesUpserted,
      errors,
      api_source: 'itunes',
      duration_ms: Date.now() - startedAt,
      metadata: {
        source: 'itunes',
        releases_found: itunesReleases.length,
        releases_merged: releasesMerged,
        concurrency: RELEASE_SYNC_CONCURRENCY,
      },
    })
  }

  return { artistId, releasesUpserted, errors }
}