import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { updateInterviewRequest } from '@/lib/api/interviewRequests'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'

const bodySchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected']).optional(),
  artistReply: z.string().nullable().optional(),
})

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl?.searchParams.get('artistId') ?? new URL(req.url).searchParams.get('artistId')
  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, artistId)

  const id = new URL(req.url).pathname.split('/').at(-1) ?? ''
  if (!id) throw new ApiError(400, 'Missing interview request id')
  const { data: existing, error: existingError } = await supabase
    .from('interview_requests')
    .select('id')
    .eq('id', id)
    .eq('artist_id', artist.id)
    .maybeSingle()
  if (existingError || !existing) {
    throw new ApiError(404, 'Interview request not found')
  }

  const body = bodySchema.parse(await req.json())
  const updated = await updateInterviewRequest(supabase, id, {
    status: body.status,
    artist_reply: body.artistReply === undefined ? undefined : body.artistReply,
  })

  return NextResponse.json(updated)
})