/**
 * PATCH /api/admin/sos/import-batches/[id]/confirm — verify R2 content and store file hash
 */

import { requireAdminFromRequest } from '@/lib/adminAuth'

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import {
  finalizeImportBatch,
  findImportBatchByFileHash,
  getImportBatchById,
  setImportBatchMultipartUpload,
  updateImportBatchStatus,
} from '@/lib/api/distributorImportBatches'
import { writeAppLog } from '@/lib/appLog'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createR2Client, deleteObjectFromR2, sha256HexFromR2Object } from '@/lib/r2Utils'
import {
  buildConfirmedBronzeKey,
  copyBronzeObjectToConfirmedKey,
} from '@/lib/sos/bronzeMultipartUpload'

export const maxDuration = 300

function extractBatchIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/import-batches\/([^/]+)\/confirm\/?$/)
  return match?.[1] ?? null
}

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdminFromRequest(req)
  const id = extractBatchIdFromPath(new URL(req.url).pathname)
  if (!id) throw new ApiError(400, 'Invalid import batch path')

  const raw = await req.text()
  if (raw.length > 4_096) throw new ApiError(413, 'Confirm payload too large')

  const body = JSON.parse(raw) as { file_hash?: string; operation_id?: string }
  const fileHash = body.file_hash?.trim()
  if (!fileHash || !/^[a-f0-9]{64}$/i.test(fileHash)) {
    throw new ApiError(400, 'file_hash must be a SHA-256 hex digest')
  }

  const normalizedHash = fileHash.toLowerCase()
  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batch = await getImportBatchById(serviceSupabase, id)
  if (!batch) throw new ApiError(404, 'Import batch not found')
  if (batch.operationId && body.operation_id !== batch.operationId) {
    throw new ApiError(409, 'operation_id does not match this import batch')
  }
  if (batch.status === 'completed') {
    if (batch.fileHash === normalizedHash) {
      return NextResponse.json({ ok: true, duplicate: false, r2Key: batch.r2Key })
    }
    throw new ApiError(409, 'This archive was already confirmed with a different hash')
  }

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const confirmedKey = buildConfirmedBronzeKey(batch.id, batch.r2Key)
  await copyBronzeObjectToConfirmedKey(
    { s3, bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME },
    batch.r2Key,
    confirmedKey,
  )
  const confirmedHash = await sha256HexFromR2Object(
    confirmedKey,
    s3,
    serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
  )
  if (confirmedHash !== normalizedHash) {
    await writeAppLog({
      source: `sos.bronze.confirm.${batch.operationId ?? id}`,
      level: 'error',
      message: 'Bronze confirm hash mismatch',
      details: { operation_id: batch.operationId, batch_id: id },
    })
    try {
      await deleteObjectFromR2(confirmedKey, s3, serverEnv.CLOUDFLARE_R2_BUCKET_NAME)
    } catch {
      // A failed finalization remains unreferenced and is recoverable by the R2 orphan scan.
    }
    throw new ApiError(400, 'Confirmed R2 object does not match the uploaded file hash')
  }

  try {
    const finalized = await finalizeImportBatch(serviceSupabase, {
      id,
      r2Key: confirmedKey,
      fileHash: normalizedHash,
    })
    if (!finalized) {
      const latest = await getImportBatchById(serviceSupabase, id)
      if (latest?.status !== 'completed' || latest.fileHash !== normalizedHash) {
        throw new ApiError(409, 'Import batch changed while its archive was being confirmed')
      }
    }
  } catch (error) {
    if ((error as { code?: string }).code !== '23505') throw error
    const existing = await findImportBatchByFileHash(serviceSupabase, normalizedHash)
    if (!existing) throw error
    await updateImportBatchStatus(serviceSupabase, id, 'failed')
    await setImportBatchMultipartUpload(serviceSupabase, id, null)
    try {
      await deleteObjectFromR2(confirmedKey, s3, serverEnv.CLOUDFLARE_R2_BUCKET_NAME)
      await deleteObjectFromR2(batch.r2Key, s3, serverEnv.CLOUDFLARE_R2_BUCKET_NAME)
    } catch {
      // The storage scan reports any remaining unreferenced object.
    }
    return NextResponse.json({ ok: true, duplicate: true, batch: existing })
  }

  try {
    await deleteObjectFromR2(batch.r2Key, s3, serverEnv.CLOUDFLARE_R2_BUCKET_NAME)
  } catch {
    // The presigned URL only targets the staging key; the confirmed key stays immutable.
  }

  return NextResponse.json({ ok: true, r2Key: confirmedKey })
})
