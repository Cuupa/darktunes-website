/**
 * app/api/portal/epk/versions/[id]/restore/route.ts
 *
 * POST — restore an EPK document from a version snapshot
 *
 * Membership via withPortalMembershipWrite; restore via portalMemberWrite.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { restoreEpkVersion } from '@/lib/api/epkDocument'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'

const bodySchema = z.object({
  artist_id: z.string().uuid(),
})

const ROUTE = 'POST /api/portal/epk/versions/[id]/restore'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const segments = req.nextUrl.pathname.split('/')
  const restoreIndex = segments.lastIndexOf('restore')
  const versionId = restoreIndex > 0 ? segments[restoreIndex - 1] : undefined
  if (!versionId) throw new ApiError(400, 'Missing version id')

  const body = bodySchema.parse(await req.json())
  const ctx = await withPortalMembershipWrite(req, body.artist_id)

  try {
    const { value: state } = await portalMemberWrite(
      ctx,
      { route: ROUTE, table: 'artist_epks', operation: 'update' },
      (db) => restoreEpkVersion(db, ctx.artist.id, versionId, ctx.user.id),
    )
    return NextResponse.json(state)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Restore failed'
    if (msg === 'EPK version not found') throw new ApiError(404, msg)
    throw err
  }
})
