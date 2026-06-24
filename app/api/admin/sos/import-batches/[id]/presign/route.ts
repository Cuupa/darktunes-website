/**
 * POST /api/admin/sos/import-batches/[id]/presign — presigned PUT URL for large bronze CSVs
 *
 * Bypasses Vercel's ~50 MB request body limit by uploading directly from the browser to R2.
 * Requires R2 bucket CORS to allow PUT from the site origin (see DEPLOYMENT.md).
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getImportBatchById } from '@/lib/api/distributorImportBatches'
import { MAX_BRONZE_CSV_BYTES } from '@/lib/sos/bronzeUploadLimits'
import { generatePresignedUploadUrl } from '@/lib/portal/presignedUrl'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createR2Client } from '@/lib/r2Utils'

const PRESIGN_BODY_MAX_BYTES = 512

async function requireAdminOrEditor() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, 'Unauthorized')
  const role = await getUserRoleWithClient(supabase, user.id)
  if (!role || !['admin', 'editor'].includes(role)) throw new ApiError(403, 'Forbidden')
}

function extractBatchIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/import-batches\/([^/]+)\/presign\/?$/)
  return match?.[1] ?? null
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdminOrEditor()
  const id = extractBatchIdFromPath(new URL(req.url).pathname)
  if (!id) throw new ApiError(400, 'Invalid import batch presign path')

  const raw = await req.text()
  if (raw.length > PRESIGN_BODY_MAX_BYTES) throw new ApiError(413, 'Presign payload too large')

  const body = JSON.parse(raw) as { content_type?: string; file_size?: number }
  const contentType = body.content_type?.trim() || 'text/csv; charset=utf-8'
  const fileSize = body.file_size

  if (typeof fileSize === 'number' && fileSize > MAX_BRONZE_CSV_BYTES) {
    throw new ApiError(413, `CSV too large (max ${MAX_BRONZE_CSV_BYTES} bytes)`)
  }

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batch = await getImportBatchById(serviceSupabase, id)
  if (!batch) throw new ApiError(404, 'Import batch not found')
  if (batch.fileHash || batch.status === 'completed') {
    throw new ApiError(409, 'Import batch already has archived content')
  }

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const uploadUrl = await generatePresignedUploadUrl(batch.r2Key, contentType, {
    getSignedUrl,
    s3Client: s3,
    bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
  })

  return NextResponse.json({ uploadUrl })
})