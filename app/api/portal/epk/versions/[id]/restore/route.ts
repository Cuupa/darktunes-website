/**
 * app/api/portal/epk/versions/[id]/restore/route.ts
 *
 * POST — restore an EPK document from a version snapshot
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { restoreEpkVersion } from '@/lib/api/epkDocument'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'

const bodySchema = z.object({
  artist_id: z.string().uuid(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)
  const segments = req.nextUrl.pathname.split('/')
  const restoreIndex = segments.lastIndexOf('restore')
  const versionId = restoreIndex > 0 ? segments[restoreIndex - 1] : undefined
  if (!versionId) throw new ApiError(400, 'Missing version id')

  const body = bodySchema.parse(await req.json())

  const artist = await resolvePortalArtist(supabase, user.id, body.artist_id).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  try {
    const state = await restoreEpkVersion(supabase, artist.id, versionId, user.id)
    return NextResponse.json(state)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Restore failed'
    if (msg === 'EPK version not found') throw new ApiError(404, msg)
    throw err
  }
})