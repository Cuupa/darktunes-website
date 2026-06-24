/**
 * Syncs external listener metrics (Last.fm, optional Soundcharts) into gold tables.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { upsertListenerMetrics } from '@/lib/api/artistListenerMetrics'
import { fetchLastfmListenerHistory } from '@/lib/analytics/lastfmApi'
import {
  fetchSoundchartsListenerHistory,
  isSoundchartsConfigured,
} from '@/lib/analytics/soundchartsApi'

type ServiceClient = SupabaseClient<Database>

export interface SyncArtistListenerInput {
  artistId: string
  name: string
  lastfmName?: string | null
  soundchartsUuid?: string | null
}

export interface SyncListenerMetricsResult {
  artistsProcessed: number
  lastfmRows: number
  soundchartsRows: number
  errors: Array<{ artistId: string; source: string; message: string }>
}

export async function syncListenerMetricsForArtists(
  db: ServiceClient,
  artists: SyncArtistListenerInput[],
  deps: {
    lastfmApiKey?: string
    soundchartsApiKey?: string
    fetchFn?: typeof fetch
  },
): Promise<SyncListenerMetricsResult> {
  const result: SyncListenerMetricsResult = {
    artistsProcessed: 0,
    lastfmRows: 0,
    soundchartsRows: 0,
    errors: [],
  }

  const fetchFn = deps.fetchFn ?? fetch
  const hasLastfm = Boolean(deps.lastfmApiKey?.trim())
  const hasSoundcharts = isSoundchartsConfigured(deps.soundchartsApiKey)

  if (!hasLastfm && !hasSoundcharts) {
    throw new Error('No external listener API configured (set LASTFM_API_KEY or SOUNDCHARTS_API_KEY)')
  }

  for (const artist of artists) {
    result.artistsProcessed += 1
    const lastfmLookup = (artist.lastfmName?.trim() || artist.name).trim()

    if (hasLastfm && lastfmLookup) {
      try {
        const points = await fetchLastfmListenerHistory(deps.lastfmApiKey!, lastfmLookup, fetchFn)
        const upserted = await upsertListenerMetrics(
          db,
          points.map((p) => ({
            artistId: artist.artistId,
            source: 'lastfm' as const,
            metricType: 'listeners' as const,
            period: p.period,
            value: p.listeners,
          })),
        )
        result.lastfmRows += upserted
      } catch (err) {
        result.errors.push({
          artistId: artist.artistId,
          source: 'lastfm',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    if (hasSoundcharts && artist.soundchartsUuid?.trim()) {
      try {
        const points = await fetchSoundchartsListenerHistory(
          deps.soundchartsApiKey!,
          artist.soundchartsUuid.trim(),
          fetchFn,
        )
        const upserted = await upsertListenerMetrics(
          db,
          points.map((p) => ({
            artistId: artist.artistId,
            source: 'soundcharts' as const,
            metricType: 'listeners' as const,
            period: p.period,
            value: p.listeners,
          })),
        )
        result.soundchartsRows += upserted
      } catch (err) {
        result.errors.push({
          artistId: artist.artistId,
          source: 'soundcharts',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
  }

  return result
}