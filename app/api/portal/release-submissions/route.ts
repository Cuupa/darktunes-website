import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getReleaseSubmissionsByArtistId } from '@/lib/api/releaseSubmissions'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ApiError(401, 'Missing authorization token')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)
  if (authError || !user) throw new ApiError(401, 'Invalid or expired token')

  const artistId = req.nextUrl?.searchParams.get('artistId') ?? new URL(req.url).searchParams.get('artistId')
  let artist
  try {
    artist = await resolvePortalArtist(supabase, user.id, artistId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  }
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const submissions = await getReleaseSubmissionsByArtistId(supabase, artist.id)
  return NextResponse.json(submissions)
})
