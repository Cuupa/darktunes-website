/**
 * app/api/portal/epk/analytics/route.ts
 *
 * GET — EPK PDF download stats for an artist
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getEpkDownloadStats } from '@/lib/api/epkDownloadEvents'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artist_id')
  if (!artistId) throw new ApiError(400, 'artist_id is required')

  const { supabase, user } = await authenticatePortalBearer(req)

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const stats = await getEpkDownloadStats(supabase, artist.id)
  return NextResponse.json({ stats })
})