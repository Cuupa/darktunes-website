/**
 * POST /api/admin/sos/import-batches/[id]/multipart/init — start R2 multipart upload
 */

import { requireAdminFromRequest } from '@/lib/adminAuth'

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getImportBatchById, setImportBatchMultipartUpload } from '@/lib/api/distributorImportBatches'
import { MAX_BRONZE_CSV_BYTES } from '@/lib/sos/bronzeUploadLimits'
import {
  createBronzeMultipartR2Context,
  getWritableImportBatch,
  abortBronzeMultipartUpload,
  bronzeObjectExists,
  initBronzeMultipartUpload,
} from '@/lib/sos/bronzeMultipartUpload'
import { ApiError, withErrorHandler } from '@/lib/errors'

const INIT_BODY_MAX_BYTES = 512

function extractBatchIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/import-batches\/([^/]+)\/multipart\/init\/?$/)
  return match?.[1] ?? null
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdminFromRequest(req)
  const id = extractBatchIdFromPath(new URL(req.url).pathname)
  if (!id) throw new ApiError(400, 'Invalid import batch multipart init path')

  const raw = await req.text()
  if (raw.length > INIT_BODY_MAX_BYTES) throw new ApiError(413, 'Init payload too large')

  const body = JSON.parse(raw) as { content_type?: string; file_size?: number }
  const contentType = body.content_type?.trim() || 'text/csv; charset=utf-8'
  const fileSize = body.file_size

  if (typeof fileSize === 'number' && fileSize > MAX_BRONZE_CSV_BYTES) {
    throw new ApiError(413, `CSV too large (max ${MAX_BRONZE_CSV_BYTES} bytes)`)
  }

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batch = await getWritableImportBatch(serviceSupabase, id)
  const ctx = await createBronzeMultipartR2Context()

  if (batch.multipartUploadId) {
    if (await bronzeObjectExists(ctx, batch.r2Key)) {
      await setImportBatchMultipartUpload(serviceSupabase, id, null)
      return NextResponse.json({ uploadId: null, completed: true })
    }
    return NextResponse.json({ uploadId: batch.multipartUploadId })
  }

  const uploadId = await initBronzeMultipartUpload(ctx, batch.r2Key, contentType)
  let saved: boolean
  try {
    saved = await setImportBatchMultipartUpload(
      serviceSupabase,
      id,
      uploadId,
      new Date().toISOString(),
      true,
    )
  } catch (error) {
    try {
      await abortBronzeMultipartUpload(ctx, batch.r2Key, uploadId)
    } catch (abortError) {
      console.warn('[bronze multipart init] cleanup failed after database error', {
        batchId: id,
        abortError,
      })
    }
    throw error
  }
  if (!saved) {
    await abortBronzeMultipartUpload(ctx, batch.r2Key, uploadId)
    const latest = await getImportBatchById(serviceSupabase, id)
    if (latest?.multipartUploadId) {
      return NextResponse.json({ uploadId: latest.multipartUploadId })
    }
    throw new ApiError(409, 'Multipart upload changed while it was starting; retry the archive')
  }

  return NextResponse.json({ uploadId })
})
