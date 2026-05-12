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
 *   3. For each release: download cover art → upload to R2 → upsert to DB
 *   4. Update artist's last_synced_at timestamp
 *   5. Write a sync_log entry (success / partial / error)
 *   6. Return SyncResult — never throws; all errors are captured in SyncResult.errors
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { withExponentialBackoff } from '@/lib/rateLimiter'
import { searchItunesArtist } from '@/lib/itunesApi'
import { upsertReleaseByItunesId } from '@/lib/api/releases'

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
}

export interface SyncResult {
  artistId: string
  releasesUpserted: number
  errors: string[]
}

function deriveReleaseType(trackCount: number): 'single' | 'ep' | 'album' {
  if (trackCount === 1) return 'single'
  if (trackCount <= 6) return 'ep'
  return 'album'
}

/**
 * Syncs one artist: fetches releases from iTunes, caches cover art in R2,
 * upserts releases to Supabase, and writes a sync_logs entry.
 *
 * This function never throws — errors are captured and returned in SyncResult.
 */
export async function syncArtist(artistId: string, deps: SyncDeps): Promise<SyncResult> {
  const { db, fetch: fetchFn, uploadToR2 } = deps
  const errors: string[] = []
  let releasesUpserted = 0

  // 1. Fetch artist from DB
  const { data: artistRow, error: artistErr } = await db
    .from('artists')
    .select('id, name')
    .eq('id', artistId)
    .single()

  if (artistErr || !artistRow) {
    const msg = artistErr?.message ?? 'Artist not found'
    return { artistId, releasesUpserted: 0, errors: [msg] }
  }

  // 2. Fetch iTunes releases with exponential backoff
  let itunesReleases: Awaited<ReturnType<typeof searchItunesArtist>> = []
  try {
    itunesReleases = await withExponentialBackoff(() =>
      searchItunesArtist(artistRow.name, fetchFn),
    )
  } catch (err) {
    errors.push(`iTunes fetch failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 3. Process each release
  for (const release of itunesReleases) {
    try {
      // 3a. Download and cache cover art in R2
      let coverArt: string | null = null
      const artworkUrl = release.artworkUrl600 ?? release.artworkUrl100
      if (artworkUrl) {
        try {
          coverArt = await uploadToR2(artworkUrl, 'cover-art')
        } catch (uploadErr) {
          errors.push(
            `Cover art upload failed for "${release.collectionName}": ${
              uploadErr instanceof Error ? uploadErr.message : String(uploadErr)
            }`,
          )
          // R2 "Unauthorized" typically means the CLOUDFLARE_R2_ACCESS_KEY_ID /
          // CLOUDFLARE_R2_SECRET_ACCESS_KEY env vars are missing or the key lacks
          // Object:Write permission on the bucket. The external iTunes URL is used
          // as a graceful fallback — no data is lost, but cover art won't be CDN-cached.
          // Graceful fallback: use the original external URL
          coverArt = artworkUrl
        }
      }

      // 3b. Upsert release to Supabase (idempotent via itunes_id)
      await upsertReleaseByItunesId(db, {
        title: release.collectionName,
        artist_id: artistId,
        artist_name: release.artistName,
        release_date: release.releaseDate.split('T')[0],
        cover_art: coverArt,
        type: deriveReleaseType(release.trackCount),
        apple_music_url: release.collectionViewUrl,
        itunes_id: String(release.collectionId),
        featured: false,
      })
      releasesUpserted++
    } catch (err) {
      errors.push(
        `Failed to upsert "${release.collectionName}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }
  }

  // 4. Update artist's last_synced_at (best-effort, ignore errors)
  await db
    .from('artists')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', artistId)

  // 5. Write sync_log entry
  const status: 'success' | 'partial' | 'error' =
    errors.length === 0 ? 'success' : releasesUpserted > 0 ? 'partial' : 'error'

  await db.from('sync_logs').insert({
    artist_id: artistId,
    status,
    message: errors[0] ?? null,
    releases_synced: releasesUpserted,
    errors,
  })

  return { artistId, releasesUpserted, errors }
}
