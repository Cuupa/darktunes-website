import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getVideoSubmissionsByArtistId } from '@/lib/api/videoSubmissions'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ApiError(401, 'Missing authorization token')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)
  if (authError || !user) throw new ApiError(401, 'Invalid or expired token')

  const artist = await getArtistByUserId(supabase, user.id)
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const submissions = await getVideoSubmissionsByArtistId(supabase, artist.id)
  return NextResponse.json(submissions)
})
