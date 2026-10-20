/**
 * GET /api/portal/release-submissions/{id}
 * Load one submission (and tracks) for the active artist — used to edit a rejected row.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'
import { getReleaseSubmissionById } from '@/lib/api/releaseSubmissions'
import { getTracksBySubmissionId } from '@/lib/api/releaseSubmissionTracks'

function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  return segments[segments.length - 1]
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const ctx = await withPortalMembershipWrite(req, artistId)
  const id = extractId(req)
  const submission = await getReleaseSubmissionById(ctx.serviceDb, id)
  if (!submission || submission.artistId !== ctx.artist.id) {
    throw new ApiError(404, 'That submission was not found. Open it from your submissions list.')
  }
  const tracks = await getTracksBySubmissionId(ctx.serviceDb, id)
  return NextResponse.json({ submission, tracks })
})
