import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/errors'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import type { TourPlannerSettings } from '@/lib/tour-planner/types'
import type { Database } from '@/types/database'
import {
  authenticatePortalBearerWithArtist,
  type PortalBearerAuthWithArtist,
} from '@/lib/portal/bearerAuth'

export async function assertTourPlannerEnabled(supabase: SupabaseClient<Database>): Promise<void> {
  const flags = await getFeatureFlagsForRole(supabase, 'artist')
  if (flags['artist.tour_planner'] === false) {
    throw new ApiError(403, 'Tour Planner is disabled for this account')
  }
}

export async function authenticateTourPlannerRequest(
  req: NextRequest,
  artistId?: string | null,
): Promise<PortalBearerAuthWithArtist> {
  const auth = await authenticatePortalBearerWithArtist(req, artistId)
  await assertTourPlannerEnabled(auth.supabase)
  return auth
}

export function resolveGoogleMapsApiKey(settings?: TourPlannerSettings): string | undefined {
  return settings?.googleApiKey ?? process.env.GOOGLE_MAPS_API_KEY
}