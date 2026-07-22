import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import {
  createDraftReleaseFromSubmission,
  updateReleaseSubmissionStatus,
} from '@/lib/api/releaseSubmissions'
import { getTracksBySubmissionId } from '@/lib/api/releaseSubmissionTracks'

function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  return segments[segments.length - 1]
}

const patchSchema = z.object({
  status: z.enum(['received', 'reviewed', 'accepted', 'rejected']),
  adminReply: z.string().optional(),
})

const postSchema = z.object({
  action: z.literal('create_draft_release'),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)
  const supabase = await createServiceRoleSupabaseClient()
  const id = extractId(req)
  const tracks = await getTracksBySubmissionId(supabase, id)
  return NextResponse.json({ tracks })
})

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)
  const supabase = await createServerSupabaseClient()

  const id = extractId(req)
  const body = patchSchema.parse(await req.json())

  const submission = await updateReleaseSubmissionStatus(
    supabase,
    id,
    body.status,
    body.adminReply,
  )

  // Send label message to artist when status is accepted or rejected
  if ((body.status === 'accepted' || body.status === 'rejected') && body.adminReply) {
    const serviceRole = await createServiceRoleSupabaseClient()
    const subjectKey = body.status === 'accepted' ? 'accepted' : 'rejected'
    const subjectMap: Record<string, string> = {
      accepted: `Your release "${submission.title}" has been accepted`,
      rejected: `Your release "${submission.title}" has been rejected`,
    }
    await serviceRole.from('label_messages').insert({
      artist_id: submission.artistId,
      subject: subjectMap[subjectKey],
      body: body.adminReply,
      body_html: `<p>${body.adminReply.replace(/\n/g, '<br>')}</p>`,
    })
  }

  return NextResponse.json(submission)
})

/**
 * POST — create a hidden catalog draft release from this submission.
 * Body: { action: 'create_draft_release' }
 * Idempotent when release_id is already set.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)
  const supabase = await createServiceRoleSupabaseClient()

  const id = extractId(req)
  const body = postSchema.parse(await req.json())
  if (body.action !== 'create_draft_release') {
    throw new ApiError(400, 'Unsupported action')
  }

  try {
    const result = await createDraftReleaseFromSubmission(supabase, id)
    return NextResponse.json(result, { status: result.created ? 201 : 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create draft release'
    if (msg === 'Submission not found') throw new ApiError(404, msg)
    throw new ApiError(500, msg)
  }
})

