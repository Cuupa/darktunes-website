/**
 * src/lib/sync/syncAll.ts
 *
 * Multi-artist, multi-API sync orchestrator.
 *
 * Orchestrates a full synchronisation run across all artists in the database:
 *   1. iTunes (existing)
 *   2. Spotify — albums + popularity + cover art
 *   3. Discogs — physical releases (catalog numbers, barcodes)
 *   4. Songkick — upcoming concerts
 *   5. Bandsintown — upcoming concerts (second source)
 *   6. Odesli — smart links for newly synced releases
 *
 * All dependencies are injected via `SyncAllDeps` for full testability.
 * The function never throws — all errors are collected in `SyncAllResult`.
 *
 * This is designed to be called from:
 *   - app/api/sync/route.ts  (manual trigger from Admin)
 *   - Supabase Edge Function / pg_cron (scheduled)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { withExponentialBackoff } from '@/lib/rateLimiter'
import { fetchSpotifyArtistReleases } from './spotifyApi'
import { fetchDiscogsArtistReleases } from './discogsApi'
import { fetchSongkickArtistCalendar } from './songkickApi'
import { fetchBandsintownArtistEvents } from './bandsintownApi'
import { resolveOdesliSmartLink } from './odesliApi'
import { deduplicateReleases } from './deduplication'
import { syncArtist } from './syncArtist'
import type { SyncDeps } from './syncArtist'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncAllDeps extends SyncDeps {
  /** Spotify client credentials — undefined means Spotify sync is skipped */
  spotify?: { clientId: string; clientSecret: string }
  /** Discogs personal access token — undefined means Discogs sync is skipped */
  discogsToken?: string
  /** Songkick API key — undefined means Songkick sync is skipped */
  songkickApiKey?: string
  /** Bandsintown API key — undefined means Bandsintown sync is skipped */
  bandsintownApiKey?: string
  /**
   * When set, only the sync step for this API source is executed.
   * Useful for per-API force-sync from the admin health widget.
   */
  onlyApi?: string
}

export interface ApiSyncResult {
  api: string
  artistsProcessed: number
  releasesUpserted: number
  concertsUpserted: number
  rateLimited: boolean
  errors: string[]
}

export interface SyncAllResult {
  results: ApiSyncResult[]
  totalErrors: number
}

// ---------------------------------------------------------------------------
// Core orchestrator
// ---------------------------------------------------------------------------

/**
 * Runs a full synchronisation across all artists and all configured APIs.
 * Returns a consolidated result — never throws.
 */
export async function syncAll(deps: SyncAllDeps): Promise<SyncAllResult> {
  const { db, fetch: fetchFn, uploadToR2, spotify, discogsToken, songkickApiKey, bandsintownApiKey, onlyApi } = deps
  const results: ApiSyncResult[] = []

  // 1. Fetch all artists
  const { data: artists, error: artistsErr } = await db.from('artists').select('*')
  if (artistsErr || !artists) {
    return {
      results: [
        {
          api: 'all',
          artistsProcessed: 0,
          releasesUpserted: 0,
          concertsUpserted: 0,
          rateLimited: false,
          errors: [artistsErr?.message ?? 'Failed to fetch artists'],
        },
      ],
      totalErrors: 1,
    }
  }

  // 2. iTunes sync (existing pipeline)
  if (!onlyApi || onlyApi === 'itunes') {
    const itunesResult: ApiSyncResult = {
      api: 'itunes',
      artistsProcessed: 0,
      releasesUpserted: 0,
      concertsUpserted: 0,
      rateLimited: false,
      errors: [],
    }
    for (const artist of artists) {
      const r = await syncArtist(artist.id, { db, fetch: fetchFn, uploadToR2 })
      itunesResult.artistsProcessed++
      itunesResult.releasesUpserted += r.releasesUpserted
      itunesResult.errors.push(...r.errors)
    }
    await writeSyncLog(db, 'itunes', itunesResult)
    results.push(itunesResult)
  }

  // 3. Spotify sync
  if ((!onlyApi || onlyApi === 'spotify') && spotify) {
    const spotifyResult: ApiSyncResult = {
      api: 'spotify',
      artistsProcessed: 0,
      releasesUpserted: 0,
      concertsUpserted: 0,
      rateLimited: false,
      errors: [],
    }

    for (const artist of artists) {
      if (!artist.spotify_id) continue
      spotifyResult.artistsProcessed++

      try {
        const spotifyReleases = await withExponentialBackoff(() =>
          fetchSpotifyArtistReleases(
            artist.spotify_id!,
            spotify.clientId,
            spotify.clientSecret,
            fetchFn,
          ),
        )

        // Fetch Discogs releases for deduplication (if token available)
        const discogsReleases = discogsToken && artist.discogs_id
          ? await withExponentialBackoff(() =>
              fetchDiscogsArtistReleases(artist.discogs_id!, discogsToken, fetchFn),
            ).catch((e) => {
              spotifyResult.errors.push(`Discogs fetch for ${artist.name}: ${String(e)}`)
              return []
            })
          : []

        const merged = deduplicateReleases(spotifyReleases, discogsReleases)

        for (const release of merged) {
          try {
            // Download and cache cover art if not already in R2
            let coverArt: string | null = release.coverUrl
            if (release.coverUrl && !release.coverUrl.startsWith('https://cdn.')) {
              try {
                coverArt = await uploadToR2(release.coverUrl, 'cover-art')
              } catch {
                // Graceful fallback
              }
            }

            // Resolve Odesli smart link for Spotify releases
            let smartUrl: string | null = null
            let appleMusicUrl: string | null = null
            if (release.spotifyUrl) {
              const odesli = await withExponentialBackoff(() =>
                resolveOdesliSmartLink(release.spotifyUrl!, fetchFn),
              ).catch(() => null)
              if (odesli) {
                smartUrl = odesli.smartUrl
                // Save Apple Music URL if Odesli returns it
                appleMusicUrl = odesli.platforms['appleMusic'] ?? odesli.platforms['itunes'] ?? null
              }
            }

            let preservedFeatured = false
            if (release.spotifyId) {
              const { data: existingRelease, error: existingReleaseErr } = await db
                .from('releases')
                .select('id, featured')
                .eq('spotify_id', release.spotifyId)
                .maybeSingle()

              if (existingReleaseErr) {
                throw new Error(existingReleaseErr.message)
              }
              preservedFeatured = existingRelease?.featured ?? false
            }

            await db
              .from('releases')
              .upsert(
                {
                  title: release.title,
                  artist_id: artist.id,
                  release_date: release.releaseDate,
                  cover_art: coverArt,
                  type: release.type,
                  spotify_url: release.spotifyUrl,
                  spotify_id: release.spotifyId,
                  apple_music_url: appleMusicUrl,
                  discogs_id: release.discogsId,
                  isrc: release.isrc,
                  barcode: release.barcode,
                  catalog_number: release.catalogNumber,
                  popularity: release.popularity,
                  smart_url: smartUrl,
                  featured: preservedFeatured,
                },
                { onConflict: 'spotify_id' },
              )
              .select()
              .single()

            spotifyResult.releasesUpserted++
          } catch (e) {
            spotifyResult.errors.push(
              `Failed to upsert "${release.title}" for ${artist.name}: ${String(e)}`,
            )
          }
        }
      } catch (e) {
        const msg = String(e)
        if (msg.includes('429')) spotifyResult.rateLimited = true
        spotifyResult.errors.push(`Spotify sync for ${artist.name}: ${msg}`)
      }
    }

    await writeSyncLog(db, 'spotify', spotifyResult)
    results.push(spotifyResult)
  }

  // 3.5. Standalone Discogs sync — runs independently of Spotify
  // Syncs releases for artists that have a discogs_id but may not have been
  // covered by the Spotify block (or when Spotify is not configured).
  if ((!onlyApi || onlyApi === 'discogs') && discogsToken) {
    const discogsResult: ApiSyncResult = {
      api: 'discogs',
      artistsProcessed: 0,
      releasesUpserted: 0,
      concertsUpserted: 0,
      rateLimited: false,
      errors: [],
    }

    for (const artist of artists) {
      if (!artist.discogs_id) continue
      discogsResult.artistsProcessed++

      try {
        const discogsReleases = await withExponentialBackoff(() =>
          fetchDiscogsArtistReleases(artist.discogs_id!, discogsToken, fetchFn),
        )

        for (const release of discogsReleases) {
          try {
            // Skip if this release already exists with a Spotify ID
            // (it will have been handled more completely by the Spotify block)
            const { data: existing } = await db
              .from('releases')
              .select('id, spotify_id')
              .eq('discogs_id', release.discogsId)
              .maybeSingle()

            if (existing?.spotify_id) continue // Already handled by Spotify sync

            let coverArt: string | null = release.coverUrl
            if (release.coverUrl && !release.coverUrl.startsWith('https://cdn.')) {
              try {
                coverArt = await uploadToR2(release.coverUrl, 'cover-art')
              } catch {
                // Graceful fallback to external URL
              }
            }

            await db
              .from('releases')
              .upsert(
                {
                  title: release.title,
                  artist_id: artist.id,
                  release_date: release.releaseDate ?? new Date().toISOString().slice(0, 10),
                  cover_art: coverArt,
                  type: release.format === 'vinyl' || release.format === 'cd' ? 'album' : 'single',
                  discogs_id: release.discogsId,
                  barcode: release.barcode,
                  catalog_number: release.catalogNumber,
                },
                { onConflict: 'discogs_id' },
              )

            discogsResult.releasesUpserted++
          } catch (e) {
            discogsResult.errors.push(
              `Failed to upsert Discogs release "${release.title}" for ${artist.name}: ${String(e)}`,
            )
          }
        }
      } catch (e) {
        const msg = String(e)
        if (msg.includes('429')) discogsResult.rateLimited = true
        discogsResult.errors.push(`Discogs sync for ${artist.name}: ${msg}`)
      }
    }

    await writeSyncLog(db, 'discogs', discogsResult)
    results.push(discogsResult)
  }

  // 4. Songkick sync
  if ((!onlyApi || onlyApi === 'songkick') && songkickApiKey) {
    const songkickResult: ApiSyncResult = {
      api: 'songkick',
      artistsProcessed: 0,
      releasesUpserted: 0,
      concertsUpserted: 0,
      rateLimited: false,
      errors: [],
    }

    for (const artist of artists) {
      if (!artist.songkick_id) continue
      songkickResult.artistsProcessed++

      try {
        const concerts = await withExponentialBackoff(() =>
          fetchSongkickArtistCalendar(artist.songkick_id!, songkickApiKey, fetchFn),
        )

        for (const concert of concerts) {
          try {
            await db
              .from('concerts')
              .upsert(
                {
                  artist_id: artist.id,
                  event_name: concert.eventName,
                  venue_name: concert.venueName,
                  venue_city: concert.venueCity,
                  venue_country: concert.venueCountry,
                  concert_date: concert.concertDate,
                  ticket_url: concert.ticketUrl,
                  songkick_id: concert.songkickId,
                  status: concert.status,
                },
                { onConflict: 'songkick_id' },
              )
              .select()
              .single()

            songkickResult.concertsUpserted++
          } catch (e) {
            songkickResult.errors.push(
              `Failed to upsert concert "${concert.eventName}": ${String(e)}`,
            )
          }
        }
      } catch (e) {
        const msg = String(e)
        if (msg.includes('429')) songkickResult.rateLimited = true
        songkickResult.errors.push(`Songkick sync for ${artist.name}: ${msg}`)
      }
    }

    await writeSyncLog(db, 'songkick', songkickResult)
    results.push(songkickResult)
  }

  // 5. Bandsintown sync — upcoming concerts (second source)
  if ((!onlyApi || onlyApi === 'bandsintown') && bandsintownApiKey) {
    const bandsintownResult: ApiSyncResult = {
      api: 'bandsintown',
      artistsProcessed: 0,
      releasesUpserted: 0,
      concertsUpserted: 0,
      rateLimited: false,
      errors: [],
    }

    for (const artist of artists) {
      if (!artist.bandsintown_id) continue
      bandsintownResult.artistsProcessed++

      try {
        const concerts = await withExponentialBackoff(() =>
          fetchBandsintownArtistEvents(artist.bandsintown_id!, bandsintownApiKey, fetchFn),
        )

        for (const concert of concerts) {
          try {
            await db
              .from('concerts')
              .upsert(
                {
                  artist_id: artist.id,
                  event_name: concert.eventName,
                  venue_name: concert.venueName,
                  venue_city: concert.venueCity,
                  venue_country: concert.venueCountry,
                  concert_date: concert.concertDate,
                  ticket_url: concert.ticketUrl,
                  bandsintown_id: concert.bandsintownId,
                  status: concert.status,
                },
                { onConflict: 'bandsintown_id' },
              )
              .select()
              .single()

            bandsintownResult.concertsUpserted++
          } catch (e) {
            bandsintownResult.errors.push(
              `Failed to upsert concert "${concert.eventName}": ${String(e)}`,
            )
          }
        }
      } catch (e) {
        const msg = String(e)
        if (msg.includes('429')) bandsintownResult.rateLimited = true
        bandsintownResult.errors.push(`Bandsintown sync for ${artist.name}: ${msg}`)
      }
    }

    await writeSyncLog(db, 'bandsintown', bandsintownResult)
    results.push(bandsintownResult)
  }

  // 6. Standalone Odesli smart-link resolution — runs regardless of whether
  // Spotify sync succeeded or was skipped.  Finds all releases that have a
  // Spotify URL or Apple Music URL but no smart_url yet, and resolves each
  // one through Odesli so they always get a working link.
  if (!onlyApi || onlyApi === 'odesli') {
    const odesliResult: ApiSyncResult = {
      api: 'odesli',
      artistsProcessed: 0,
      releasesUpserted: 0,
      concertsUpserted: 0,
      rateLimited: false,
      errors: [],
    }

    try {
      // PostgREST "not null" filter: column.not.is.null is valid PostgREST syntax
      const { data: releasesWithoutSmartUrl, error: batchErr } = await db
        .from('releases')
        .select('id, spotify_url, apple_music_url')
        .is('smart_url', null)
        .or('spotify_url.not.is.null,apple_music_url.not.is.null')

      if (batchErr) {
        odesliResult.errors.push(`Odesli batch query failed: ${batchErr.message}`)
      }

      for (const release of releasesWithoutSmartUrl ?? []) {
        const musicUrl = release.spotify_url ?? release.apple_music_url
        if (!musicUrl) continue

        odesliResult.artistsProcessed++ // counts releases attempted (field reused for parity)

        try {
          let odesliErr: string | null = null
          let odesli: Awaited<ReturnType<typeof resolveOdesliSmartLink>> | null = null
          try {
            odesli = await withExponentialBackoff(() =>
              resolveOdesliSmartLink(musicUrl, fetchFn),
            )
          } catch (e) {
            odesliErr = String(e)
          }

          if (odesli) {
            const appleMusicUrl =
              odesli.platforms['appleMusic'] ?? odesli.platforms['itunes'] ?? null

            const { error: updateErr } = await db
              .from('releases')
              .update({
                smart_url: odesli.smartUrl,
                ...(appleMusicUrl && !release.apple_music_url
                  ? { apple_music_url: appleMusicUrl }
                  : {}),
              })
              .eq('id', release.id)

            if (updateErr) {
              odesliResult.errors.push(
                `Odesli DB update for release ${release.id}: ${updateErr.message}`,
              )
            } else {
              odesliResult.releasesUpserted++
            }
          } else if (odesliErr) {
            // Only push an error if there was an actual failure (not just "not found")
            if (!odesliErr.includes('404') && !odesliErr.includes('No match')) {
              odesliResult.errors.push(`Odesli resolve for release ${release.id}: ${odesliErr}`)
            }
            if (odesliErr.includes('429')) odesliResult.rateLimited = true
          }
        } catch (e) {
          odesliResult.errors.push(`Odesli resolve for release ${release.id}: ${String(e)}`)
        }
      }
    } catch (e) {
      odesliResult.errors.push(`Odesli batch query failed: ${String(e)}`)
    }

    await writeSyncLog(db, 'odesli', odesliResult)
    results.push(odesliResult)
  }

  // 7. Odesli platform links for artists — finds all artists that have a
  // Spotify URL or Apple Music URL but no platform_links yet, and resolves
  // each one through Odesli to populate per-platform streaming URLs.
  // Results are merged into the existing odesliResult (same api_source).
  if (!onlyApi || onlyApi === 'odesli') {
    // Find the existing odesliResult from step 6, or create a fresh one when
    // the caller used onlyApi='odesli' (step 6 already ran and pushed it).
    const existingOdesli = results.find((r) => r.api === 'odesli')

    try {
      const { data: artistsWithoutPlatformLinks, error: batchErr } = await db
        .from('artists')
        .select('id, spotify_url, apple_music_url')
        .is('platform_links', null)
        .or('spotify_url.not.is.null,apple_music_url.not.is.null')

      if (batchErr) {
        existingOdesli?.errors.push(`Odesli artist batch query failed: ${batchErr.message}`)
      }

      for (const artist of artistsWithoutPlatformLinks ?? []) {
        const musicUrl = artist.spotify_url ?? artist.apple_music_url
        if (!musicUrl) continue

        if (existingOdesli) existingOdesli.artistsProcessed++

        try {
          let odesliErr: string | null = null
          let odesli: Awaited<ReturnType<typeof resolveOdesliSmartLink>> | null = null
          try {
            odesli = await withExponentialBackoff(() =>
              resolveOdesliSmartLink(musicUrl, fetchFn),
            )
          } catch (e) {
            odesliErr = String(e)
          }

          if (odesli && Object.keys(odesli.platforms).length > 0) {
            const { error: updateErr } = await db
              .from('artists')
              .update({ platform_links: odesli.platforms })
              .eq('id', artist.id)

            if (updateErr) {
              existingOdesli?.errors.push(
                `Odesli DB update for artist ${artist.id}: ${updateErr.message}`,
              )
            } else {
              if (existingOdesli) existingOdesli.releasesUpserted++ // counts artist updates (field reused for parity)
            }
          } else if (odesliErr) {
            // 404/no-match responses are expected for some artists — skip silently
            if (!odesliErr.includes('404') && !odesliErr.includes('No match')) {
              existingOdesli?.errors.push(`Odesli resolve for artist ${artist.id}: ${odesliErr}`)
            }
            if (odesliErr.includes('429') && existingOdesli) existingOdesli.rateLimited = true
          }
        } catch (e) {
          existingOdesli?.errors.push(`Odesli resolve for artist ${artist.id}: ${String(e)}`)
        }
      }
    } catch (e) {
      existingOdesli?.errors.push(`Odesli artist batch query failed: ${String(e)}`)
    }

    // Update the sync_log with the combined release+artist result
    if (existingOdesli) {
      await writeSyncLog(db, 'odesli', existingOdesli)
    }
  }

  return {
    results,
    totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function writeSyncLog(
  db: SupabaseClient<Database>,
  apiSource: string,
  result: ApiSyncResult,
): Promise<void> {
  const status: 'success' | 'partial' | 'error' =
    result.errors.length === 0
      ? 'success'
      : result.releasesUpserted + result.concertsUpserted > 0
        ? 'partial'
        : 'error'

  await db.from('sync_logs').insert({
    artist_id: null,
    status,
    message: result.errors[0] ?? null,
    releases_synced: result.releasesUpserted,
    errors: result.errors,
    api_source: apiSource,
    rate_limited: result.rateLimited,
  })
}
