import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'
import { getVideoSubmissionsByArtistId } from '@/lib/api/videoSubmissions'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId =
    req.nextUrl?.searchParams.get('artistId') ?? new URL(req.url).searchParams.get('artistId')
  const ctx = await withPortalMembershipWrite(req, artistId)
  const { value: submissions } = await portalMemberWrite(
    ctx,
    { route: 'GET /api/portal/video-submissions', table: 'video_submissions', operation: 'select' },
    (db) => getVideoSubmissionsByArtistId(db, ctx.artist.id),
  )
  return NextResponse.json(submissions)
})
