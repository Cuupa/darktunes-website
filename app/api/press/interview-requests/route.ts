import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createInterviewRequest } from '@/lib/api/interviewRequests'

const bodySchema = z.object({
  artistId: z.string().uuid(),
  subject: z.string().min(1),
  message: z.string().min(1),
  preferredDate: z.string().nullable().optional(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ApiError(401, 'Missing authorization token')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)
  if (authError || !user) throw new ApiError(401, 'Invalid or expired token')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || !['journalist', 'admin'].includes(profile.role)) {
    throw new ApiError(403, 'Only journalists can submit interview requests')
  }

  const body = bodySchema.parse(await req.json())
  const request = await createInterviewRequest(supabase, {
    journalist_id: user.id,
    artist_id: body.artistId,
    subject: body.subject,
    message: body.message,
    preferred_date: body.preferredDate ?? null,
    status: 'pending',
  })

  return NextResponse.json(request)
})
