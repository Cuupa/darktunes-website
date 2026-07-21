/**
 * POST /api/admin/sos/import-batches/[id]/presign-upload — presigned PUT URL for direct browser → R2 upload
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import {
  BRONZE_SINGLE_PUT_MAX_BYTES,
  MAX_BRONZE_CSV_BYTES,
} from '@/lib/sos/bronzeUploadLimits'
import { generateBronzePresignedPutUrl } from '@/lib/sos/bronzePresignedUpload'
import { getWritableImportBatch } from '@/lib/sos/bronzeMultipartUpload'
import { ApiError, withErrorHandler } from '@/lib/errors'

const BODY_MAX_BYTES = 512

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, 'Unauthorized')
  const role = await getUserRoleWithClient(supabase, user.id)
  if (!role || !['admin'].includes(role)) throw new ApiError(403, 'Forbidden')
}

function extractBatchIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/import-batches\/([^/]+)\/presign-upload\/?$/)
  return match?.[1] ?? null
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdmin()
  const id = extractBatchIdFromPath(new URL(req.url).pathname)
  if (!id) throw new ApiError(400, 'Invalid presign-upload path')

  const raw = await req.text()
  if (raw.length > BODY_MAX_BYTES) throw new ApiError(413, 'Presign payload too large')

  const body = JSON.parse(raw) as { content_type?: string; file_size?: number }
  const contentType = body.content_type?.trim() || 'text/csv; charset=utf-8'
  const fileSize = body.file_size

  if (typeof fileSize === 'number') {
    if (fileSize > MAX_BRONZE_CSV_BYTES) {
      throw new ApiError(413, `CSV too large (max ${MAX_BRONZE_CSV_BYTES} bytes)`)
    }
    if (fileSize > BRONZE_SINGLE_PUT_MAX_BYTES) {
      throw new ApiError(400, 'File exceeds single-PUT limit; use multipart presign flow')
    }
  }

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batch = await getWritableImportBatch(serviceSupabase, id)
  const uploadUrl = await generateBronzePresignedPutUrl(batch.r2Key, contentType)

  return NextResponse.json({ uploadUrl, r2Key: batch.r2Key })
})