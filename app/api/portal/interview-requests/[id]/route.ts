import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { updateInterviewRequest } from '@/lib/api/interviewRequests'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'

const bodySchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected']).optional(),
  artistReply: z.string().nullable().optional(),
})

const ROUTE = 'PATCH /api/portal/interview-requests/[id]'

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const artistId =
    req.nextUrl?.searchParams.get('artistId') ?? new URL(req.url).searchParams.get('artistId')
  const ctx = await withPortalMembershipWrite(req, artistId)

  const id = new URL(req.url).pathname.split('/').at(-1) ?? ''
  if (!id) throw new ApiError(400, 'Missing interview request id')

  const { value: existing } = await portalMemberWrite(
    ctx,
    { route: ROUTE, table: 'interview_requests', operation: 'select' },
    async (db) => {
      const { data, error } = await db
        .from('interview_requests')
        .select('id')
        .eq('id', id)
        .eq('artist_id', ctx.artist.id)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    },
  )
  if (!existing) throw new ApiError(404, 'Interview request not found')

  const body = bodySchema.parse(await req.json())
  const { value: updated } = await portalMemberWrite(
    ctx,
    { route: ROUTE, table: 'interview_requests', operation: 'update' },
    (db) =>
      updateInterviewRequest(db, id, {
        status: body.status,
        artist_reply: body.artistReply === undefined ? undefined : body.artistReply,
      }),
  )

  return NextResponse.json(updated)
})
