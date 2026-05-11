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
  /** Bandsintown app_id — undefined means Bandsintown sync is skipped */
  bandsintownAppId?: string
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
  const { db, fetch: fetchFn, uploadToR2, spotify, discogsToken, songkickApiKey, bandsintownAppId } = deps
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

  // 3. Spotify sync
  if (spotify) {
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
            if (release.spotifyUrl) {
              smartUrl = await withExponentialBackoff(() =>
                resolveOdesliSmartLink(release.spotifyUrl!, fetchFn),
              )
                .then((r) => r.smartUrl)
                .catch(() => null)
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
                  artist_name: artist.name,
                  release_date: release.releaseDate,
                  cover_art: coverArt,
                  type: release.type,
                  spotify_url: release.spotifyUrl,
                  spotify_id: release.spotifyId,
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

  // 4. Songkick sync
  if (songkickApiKey) {
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
                  artist_name: artist.name,
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
  if (bandsintownAppId) {
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
          fetchBandsintownArtistEvents(artist.bandsintown_id!, bandsintownAppId, fetchFn),
        )

        for (const concert of concerts) {
          try {
            await db
              .from('concerts')
              .upsert(
                {
                  artist_id: artist.id,
                  artist_name: artist.name,
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
