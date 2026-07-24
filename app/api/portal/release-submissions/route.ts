import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'
import { getReleaseSubmissionsByArtistId } from '@/lib/api/releaseSubmissions'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId =
    req.nextUrl?.searchParams.get('artistId') ?? new URL(req.url).searchParams.get('artistId')
  const ctx = await withPortalMembershipWrite(req, artistId)
  const { value: submissions } = await portalMemberWrite(
    ctx,
    { route: 'GET /api/portal/release-submissions', table: 'release_submissions', operation: 'select' },
    (db) => getReleaseSubmissionsByArtistId(db, ctx.artist.id),
  )
  return NextResponse.json(submissions)
})
