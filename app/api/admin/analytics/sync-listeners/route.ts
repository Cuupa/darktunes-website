/**
 * POST /api/admin/analytics/sync-listeners
 * Fetches Last.fm (and optional Soundcharts) listener trends for portal artists.
 */

import { NextResponse } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { syncListenerMetricsForArtists } from '@/lib/analytics/syncListenerMetrics'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { getListenerAnalyticsCredentials } from '@/lib/secrets/getExternalCredentials'

async function requireAdminOrEditor() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, 'Unauthorized')
  const role = await getUserRoleWithClient(supabase, user.id)
  if (!role || !['admin', 'editor'].includes(role)) throw new ApiError(403, 'Forbidden')
}

export const POST = withErrorHandler(async (): Promise<NextResponse> => {
  await requireAdminOrEditor()

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const { lastfmApiKey, soundchartsApiKey } = await getListenerAnalyticsCredentials(serviceSupabase)

  const { data: artists, error } = await serviceSupabase
    .from('artists')
    .select('id, name, lastfm_name, soundcharts_id')
    .eq('is_visible', true)

  if (error) throw new ApiError(500, error.message)

  const startedAt = Date.now()

  const result = await syncListenerMetricsForArtists(
    serviceSupabase,
    (artists ?? []).map((a) => ({
      artistId: a.id,
      name: a.name,
      lastfmName: a.lastfm_name,
      soundchartsUuid: a.soundcharts_id,
    })),
    {
      lastfmApiKey: lastfmApiKey ?? undefined,
      soundchartsApiKey: soundchartsApiKey ?? undefined,
    },
  )

  const durationMs = Date.now() - startedAt

  if (lastfmApiKey) {
    const lastfmErrors = result.errors
      .filter((e) => e.source === 'lastfm')
      .map((e) => `${e.artistId}: ${e.message}`)
    const lastfmStatus =
      lastfmErrors.length === 0 ? 'success' : result.lastfmRows > 0 ? 'partial' : 'error'

    await serviceSupabase.from('sync_logs').insert({
      artist_id: null,
      status: lastfmStatus,
      message: lastfmErrors[0] ?? null,
      releases_synced: result.lastfmRows,
      errors: lastfmErrors,
      api_source: 'lastfm',
      rate_limited: false,
      duration_ms: durationMs,
      metadata: {
        artists_processed: result.artistsProcessed,
        source: 'lastfm',
      },
    })
  }

  if (soundchartsApiKey) {
    const soundchartsErrors = result.errors
      .filter((e) => e.source === 'soundcharts')
      .map((e) => `${e.artistId}: ${e.message}`)
    const soundchartsStatus =
      soundchartsErrors.length === 0
        ? 'success'
        : result.soundchartsRows > 0
          ? 'partial'
          : 'error'

    await serviceSupabase.from('sync_logs').insert({
      artist_id: null,
      status: soundchartsStatus,
      message: soundchartsErrors[0] ?? null,
      releases_synced: result.soundchartsRows,
      errors: soundchartsErrors,
      api_source: 'soundcharts',
      rate_limited: false,
      duration_ms: durationMs,
      metadata: {
        artists_processed: result.artistsProcessed,
        source: 'soundcharts',
      },
    })
  }

  return NextResponse.json(result)
})