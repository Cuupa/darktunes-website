import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'
import { getReleaseSubmissionsByArtistId } from '@/lib/api/releaseSubmissions'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl?.searchParams.get('artistId') ?? new URL(req.url).searchParams.get('artistId')
  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, artistId)

  const submissions = await getReleaseSubmissionsByArtistId(supabase, artist.id)
  return NextResponse.json(submissions)
})