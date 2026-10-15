/**
 * POST /api/admin/sos/import-batches/[id]/multipart/abort — cancel in-progress multipart upload
 */

import { requireAdminFromRequest } from '@/lib/adminAuth'

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { setImportBatchMultipartUpload } from '@/lib/api/distributorImportBatches'
import {
  abortBronzeMultipartUpload,
  createBronzeMultipartR2Context,
  getWritableImportBatch,
} from '@/lib/sos/bronzeMultipartUpload'
import { ApiError, withErrorHandler } from '@/lib/errors'

const ABORT_BODY_MAX_BYTES = 512

function extractBatchIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/import-batches\/([^/]+)\/multipart\/abort\/?$/)
  return match?.[1] ?? null
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdminFromRequest(req)
  const id = extractBatchIdFromPath(new URL(req.url).pathname)
  if (!id) throw new ApiError(400, 'Invalid import batch multipart abort path')

  const raw = await req.text()
  if (raw.length > ABORT_BODY_MAX_BYTES) throw new ApiError(413, 'Abort payload too large')

  const body = raw.trim() ? (JSON.parse(raw) as { upload_id?: string }) : {}
  const requestedUploadId = body.upload_id?.trim()

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batch = await getWritableImportBatch(serviceSupabase, id)
  if (requestedUploadId && batch.multipartUploadId && requestedUploadId !== batch.multipartUploadId) {
    throw new ApiError(409, 'Multipart upload ID does not match this batch')
  }
  const uploadId = batch.multipartUploadId ?? requestedUploadId
  if (!uploadId) return NextResponse.json({ ok: true, already_aborted: true })

  const ctx = await createBronzeMultipartR2Context()
  await abortBronzeMultipartUpload(ctx, batch.r2Key, uploadId)
  if (batch.multipartUploadId === uploadId) {
    await setImportBatchMultipartUpload(serviceSupabase, id, null)
  }

  return NextResponse.json({ ok: true })
})
