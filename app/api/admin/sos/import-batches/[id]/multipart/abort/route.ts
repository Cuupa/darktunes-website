/**
 * POST /api/admin/sos/import-batches/[id]/multipart/abort — cancel in-progress multipart upload
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import {
  abortBronzeMultipartUpload,
  createBronzeMultipartR2Context,
  getWritableImportBatch,
} from '@/lib/sos/bronzeMultipartUpload'
import { ApiError, withErrorHandler } from '@/lib/errors'

const ABORT_BODY_MAX_BYTES = 512

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
  const match = pathname.match(/\/import-batches\/([^/]+)\/multipart\/abort\/?$/)
  return match?.[1] ?? null
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdminOrEditor()
  const id = extractBatchIdFromPath(new URL(req.url).pathname)
  if (!id) throw new ApiError(400, 'Invalid import batch multipart abort path')

  const raw = await req.text()
  if (raw.length > ABORT_BODY_MAX_BYTES) throw new ApiError(413, 'Abort payload too large')

  const body = JSON.parse(raw) as { upload_id?: string }
  const uploadId = body.upload_id?.trim()
  if (!uploadId) throw new ApiError(400, 'upload_id is required')

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batch = await getWritableImportBatch(serviceSupabase, id)
  const ctx = await createBronzeMultipartR2Context()
  await abortBronzeMultipartUpload(ctx, batch.r2Key, uploadId)

  return NextResponse.json({ ok: true })
})