import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { updateInterviewRequest } from '@/lib/api/interviewRequests'

const bodySchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected']).optional(),
  artistReply: z.string().nullable().optional(),
})

export const PATCH = withErrorHandler(async (req: NextRequest) => {
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

  const id = new URL(req.url).pathname.split('/').at(-1) ?? ''
  if (!id) throw new ApiError(400, 'Missing interview request id')
  const { data: existing, error: existingError } = await supabase
    .from('interview_requests')
    .select('id, artist_id')
    .eq('id', id)
    .maybeSingle()
  if (existingError || !existing || existing.artist_id !== artist.id) {
    throw new ApiError(404, 'Interview request not found')
  }

  const body = bodySchema.parse(await req.json())
  const updated = await updateInterviewRequest(supabase, id, {
    status: body.status,
    artist_reply: body.artistReply === undefined ? undefined : body.artistReply,
  })

  return NextResponse.json(updated)
})
