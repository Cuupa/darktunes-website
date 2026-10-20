import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import {
  createDraftReleaseFromSubmission,
  getReleaseSubmissionById,
  updateReleaseSubmissionStatus,
} from '@/lib/api/releaseSubmissions'
import {
  buildR2PublicUrl,
  createR2Client,
  downloadObjectBufferFromR2,
  objectExistsInR2,
  putObjectToR2,
} from '@/lib/r2Utils'
import {
  canTransitionSubmissionStatus,
  rejectionRequiresReply,
} from '@/lib/submissions/submissionStatus'
import { getTracksBySubmissionId } from '@/lib/api/releaseSubmissionTracks'
import { emitNotification } from '@/lib/notifications/emit'

async function copySubmissionCoverToCatalog(
  db: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>,
  releaseId: string,
  coverR2Key: string,
): Promise<string> {
  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )
  const bytes = await downloadObjectBufferFromR2(
    coverR2Key,
    s3,
    serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
  )
  const buffer = Buffer.from(bytes)
  const key = `cover-art/${createHash('sha256').update(buffer).digest('hex')}.jpeg`
  if (!(await objectExistsInR2(s3, serverEnv.CLOUDFLARE_R2_BUCKET_NAME, key))) {
    await putObjectToR2(s3, serverEnv.CLOUDFLARE_R2_BUCKET_NAME, key, buffer, 'image/jpeg')
  }
  const url = buildR2PublicUrl(serverEnv.CLOUDFLARE_R2_PUBLIC_URL, key)
  const { error } = await db.from('releases').update({ cover_art: url }).eq('id', releaseId)
  if (error) throw new Error(error.message)
  return url
}

function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  return segments[segments.length - 1]
}

const patchSchema = z.object({
  status: z.enum(['received', 'reviewed', 'accepted', 'rejected']),
  adminReply: z.string().optional(),
  /** Free-text pipeline note shown to the artist. Empty string clears. */
  progressNote: z.string().max(2000).optional().nullable(),
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
  const current = await getReleaseSubmissionById(supabase, id)
  if (!current) throw new ApiError(404, 'Submission not found.')
  if (!canTransitionSubmissionStatus(current.status, body.status)) {
    throw new ApiError(
      409,
      `Cannot change status from ${current.status} to ${body.status}. Choose an allowed next status.`,
    )
  }
  if (rejectionRequiresReply(body.status) && !body.adminReply?.trim()) {
    throw new ApiError(
      422,
      'A message to the artist is required when rejecting. Write the reason, then reject.',
    )
  }

  const progressNote =
    body.progressNote === undefined
      ? undefined
      : body.progressNote === null || body.progressNote.trim() === ''
        ? null
        : body.progressNote.trim()

  const submission = await updateReleaseSubmissionStatus(
    supabase,
    id,
    body.status,
    body.adminReply,
    progressNote,
  )

  if (body.status === 'accepted' || body.status === 'rejected') {
    const serviceRole = await createServiceRoleSupabaseClient()
    const decisionLabel = body.status === 'accepted' ? 'accepted' : 'rejected'
    const subjectMap: Record<string, string> = {
      accepted: `Your release "${submission.title}" has been accepted`,
      rejected: `Your release "${submission.title}" has been rejected`,
    }

    if (body.adminReply) {
      await serviceRole.from('label_messages').insert({
        artist_id: submission.artistId,
        subject: subjectMap[decisionLabel],
        body: body.adminReply,
        body_html: `<p>${body.adminReply.replace(/\n/g, '<br>')}</p>`,
      })
    }

    await emitNotification(serviceRole, {
      type: 'release_submission_decision',
      entityId: submission.id,
      entityName: subjectMap[decisionLabel],
      artistId: submission.artistId,
      payload: { status: body.status },
      dedupeKey: `release_submission_decision:${submission.id}:${body.status}`,
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
    let release = result.release
    const coverKey = result.submission.coverR2Key
    if (coverKey && !release.coverArt) {
      try {
        const url = await copySubmissionCoverToCatalog(supabase, release.id, coverKey)
        release = { ...release, coverArt: url }
      } catch (coverErr) {
        console.error(
          '[create_draft_release] cover copy',
          coverErr instanceof Error ? coverErr.message : coverErr,
        )
      }
    }
    return NextResponse.json({ ...result, release }, { status: result.created ? 201 : 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create draft release'
    if (msg === 'Submission not found') throw new ApiError(404, msg)
    throw new ApiError(500, msg)
  }
})

