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

  return NextResponse.json(result)
})