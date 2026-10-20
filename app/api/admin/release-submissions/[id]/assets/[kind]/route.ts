/**
 * GET /api/admin/release-submissions/{id}/assets/{kind}
 * Presigned download for submission audio or cover.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getReleaseSubmissionById } from '@/lib/api/releaseSubmissions'
import { createR2Client } from '@/lib/r2Utils'

function extractParams(req: NextRequest): { id: string; kind: string } {
  const segments = new URL(req.url).pathname.split('/').filter(Boolean)
  const kind = segments[segments.length - 1] ?? ''
  const id = segments[segments.length - 3] ?? ''
  return { id, kind }
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)
  const { id, kind } = extractParams(req)
  if (kind !== 'audio' && kind !== 'cover') {
    throw new ApiError(400, 'Download kind must be audio or cover.')
  }

  const db = await createServiceRoleSupabaseClient()
  const submission = await getReleaseSubmissionById(db, id)
  if (!submission) throw new ApiError(404, 'Submission not found.')

  const r2Key = kind === 'audio' ? submission.audioR2Key : submission.coverR2Key
  const legacyUrl = kind === 'audio' ? submission.audioDownloadUrl : submission.coverArtUrl
  if (!r2Key) {
    if (legacyUrl) {
      return NextResponse.json({ download_url: legacyUrl, expires_in: null, legacy: true })
    }
    throw new ApiError(
      404,
      kind === 'audio'
        ? 'No audio file is stored for this submission.'
        : 'No cover file is stored for this submission.',
    )
  }

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )
  const downloadUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME, Key: r2Key }),
    { expiresIn: 300 },
  )
  return NextResponse.json({ download_url: downloadUrl, expires_in: 300, legacy: false })
})
