/**
 * POST /api/admin/sos/import-batches/[id]/multipart/part — upload one multipart chunk to R2
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { MAX_BRONZE_MULTIPART_PART_BYTES } from '@/lib/sos/bronzeUploadLimits'
import {
  createBronzeMultipartR2Context,
  getWritableImportBatch,
  uploadBronzeMultipartPart,
} from '@/lib/sos/bronzeMultipartUpload'
import { ApiError, withErrorHandler } from '@/lib/errors'

const MAX_PART_BYTES = MAX_BRONZE_MULTIPART_PART_BYTES

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
  const match = pathname.match(/\/import-batches\/([^/]+)\/multipart\/part\/?$/)
  return match?.[1] ?? null
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdmin()
  const id = extractBatchIdFromPath(new URL(req.url).pathname)
  if (!id) throw new ApiError(400, 'Invalid import batch multipart part path')

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    throw new ApiError(400, 'Failed to parse form data')
  }

  const file = formData.get('file')
  if (!(file instanceof File)) throw new ApiError(400, 'file is required')

  const uploadId = String(formData.get('upload_id') ?? '').trim()
  if (!uploadId) throw new ApiError(400, 'upload_id is required')

  const partNumberRaw = formData.get('part_number')
  const partNumber = Number(partNumberRaw)
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) {
    throw new ApiError(400, 'part_number must be a positive integer')
  }

  if (file.size > MAX_PART_BYTES) {
    throw new ApiError(413, `Upload part too large (max ${MAX_PART_BYTES} bytes)`)
  }

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batch = await getWritableImportBatch(serviceSupabase, id)
  const ctx = await createBronzeMultipartR2Context()
  const body = Buffer.from(await file.arrayBuffer())
  const etag = await uploadBronzeMultipartPart(ctx, batch.r2Key, uploadId, partNumber, body)

  return NextResponse.json({ etag, partNumber })
})