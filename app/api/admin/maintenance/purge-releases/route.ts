/**
 * app/api/admin/maintenance/purge-releases/route.ts
 *
 * POST /api/admin/maintenance/purge-releases
 * Auth: admin only
 * Returns: { releasesDeleted: number, junctionDeleted: number }
 *
 * Permanently deletes ALL rows from `release_artists` (junction table) and
 * then ALL rows from `releases`. This is an irreversible, destructive operation
 * guarded by a two-step confirmation in the UI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdmin(token)

  const db = await createServiceRoleSupabaseClient()

  // Delete release_artists first to avoid FK violations (even though CASCADE
  // would handle it, being explicit is safer and gives us the count).
  const { data: junctionData, error: junctionError } = await db
    .from('release_artists')
    .delete()
    .not('release_id', 'is', null)
    .select('release_id')

  if (junctionError) {
    throw new ApiError(500, `Failed to purge release_artists: ${junctionError.message}`)
  }

  // Now delete all releases
  const { data: releasesData, error: releasesError } = await db
    .from('releases')
    .delete()
    .not('id', 'is', null)
    .select('id')

  if (releasesError) {
    throw new ApiError(500, `Failed to purge releases: ${releasesError.message}`)
  }

  return NextResponse.json({
    releasesDeleted: (releasesData ?? []).length,
    junctionDeleted: (junctionData ?? []).length,
  })
})
