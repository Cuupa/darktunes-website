/**
 * app/api/portal/epk/versions/route.ts
 *
 * GET — list EPK document version snapshots for the active artist
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { listEpkVersions } from '@/lib/api/epkVersions'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)
  const artistId = new URL(req.url).searchParams.get('artistId')

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const versions = await listEpkVersions(supabase, artist.id)
  return NextResponse.json({
    versions: versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      label: v.label,
      createdAt: v.createdAt,
    })),
  })
})