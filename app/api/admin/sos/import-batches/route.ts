/**
 * GET  /api/admin/sos/import-batches — list bronze import batches
 * POST /api/admin/sos/import-batches — register a bronze CSV import (upload via [id]/upload)
 */

import { requireAdminFromRequest } from '@/lib/adminAuth'

import { randomUUID, createHash } from 'crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import {
  createImportBatch,
  DuplicateImportBatchError,
  getImportBatchByOperationId,
  findImportBatchByFileHash,
  listImportBatches,
  updateImportBatchStatus,
} from '@/lib/api/distributorImportBatches'
import { assertSettlementPeriodWritable } from '@/lib/api/settlementPeriods'
import { ApiError, withErrorHandler } from '@/lib/errors'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdminFromRequest(req)
  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batches = await listImportBatches(serviceSupabase, 100)
  return NextResponse.json({ batches })
})

const MAX_REGISTRATION_BODY_BYTES = 16_384

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { userId } = await requireAdminFromRequest(req)
  const user = { id: userId }

  const rawBody = await req.text()
  if (rawBody.length > MAX_REGISTRATION_BODY_BYTES) {
    throw new ApiError(
      413,
      'Registration payload too large. Send file bytes to /api/admin/sos/import-batches/[id]/upload instead.',
    )
  }

  const body = JSON.parse(rawBody) as {
    period_start?: string
    period_end?: string
    distributor?: string
    filename?: string
    file_hash?: string
    operation_id?: string
    row_count?: number
    file_size?: number
  }

  const {
    period_start,
    period_end,
    distributor,
    filename,
    file_hash,
    operation_id,
    row_count,
  } = body

  if (!period_start || !period_end || !distributor || !filename) {
    throw new ApiError(400, 'period_start, period_end, distributor, and filename are required')
  }
  if (!operation_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operation_id)) {
    throw new ApiError(400, 'operation_id must be a UUID')
  }

  const serviceSupabase = await createServiceRoleSupabaseClient()

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const existingOperation = await getImportBatchByOperationId(serviceSupabase, operation_id)
  if (existingOperation) {
    if (
      existingOperation.periodStart !== period_start ||
      existingOperation.periodEnd !== period_end ||
      existingOperation.distributor !== distributor ||
      existingOperation.rowCount !== (row_count ?? 0) ||
      !existingOperation.r2Key.endsWith(`_${safeName}`)
    ) {
      throw new ApiError(409, 'operation_id was already used for a different import')
    }
    if (existingOperation.status === 'completed') {
      return NextResponse.json({ batch: existingOperation, duplicate: true }, { status: 200 })
    }
    if (existingOperation.status === 'failed') {
      throw new ApiError(409, 'This import attempt is marked failed; start a new upload attempt')
    }
    return NextResponse.json(
      { batch: existingOperation, r2Key: existingOperation.r2Key },
      { status: 200 },
    )
  }

  if (file_hash && /^[a-f0-9]{64}$/i.test(file_hash)) {
    const existing = await findImportBatchByFileHash(serviceSupabase, file_hash)
    if (existing?.status === 'completed') {
      return NextResponse.json({ batch: existing, duplicate: true }, { status: 200 })
    }
    // Unconfirmed rows that already hold this hash (legacy register-before-upload)
    // block the unique index and must not skip a real retry.
    if (existing) {
      await updateImportBatchStatus(serviceSupabase, existing.id, 'failed')
    }
  }

  const batchId = randomUUID()
  const hashPrefix = file_hash?.slice(0, 12) ?? createHash('sha256').update(`${batchId}-${filename}`).digest('hex').slice(0, 12)
  const r2Key = `sos-imports/${batchId}/${hashPrefix}_${safeName}`

  await assertSettlementPeriodWritable(serviceSupabase, period_start, period_end)

  const normalizedHash =
    file_hash && /^[a-f0-9]{64}$/i.test(file_hash) ? file_hash.toLowerCase() : null

  try {
    const batch = await createImportBatch(serviceSupabase, {
      periodStart: period_start,
      periodEnd: period_end,
      distributor,
      r2Key,
      operationId: operation_id,
      // Hash is a duplicate-lookup key at register; persist only after confirm.
      fileHash: null,
      rowCount: row_count ?? 0,
      uploadedBy: user.id,
    })

    return NextResponse.json({ batch, r2Key }, { status: 201 })
  } catch (err) {
    if (err instanceof DuplicateImportBatchError) {
      const operationBatch = await getImportBatchByOperationId(serviceSupabase, operation_id)
      if (operationBatch) {
        if (
          operationBatch.periodStart !== period_start ||
          operationBatch.periodEnd !== period_end ||
          operationBatch.distributor !== distributor ||
          operationBatch.rowCount !== (row_count ?? 0) ||
          !operationBatch.r2Key.endsWith(`_${safeName}`)
        ) {
          throw new ApiError(409, 'operation_id was already used for a different import')
        }
        return NextResponse.json(
          operationBatch.status === 'completed'
            ? { batch: operationBatch, duplicate: true }
            : { batch: operationBatch, r2Key: operationBatch.r2Key },
          { status: 200 },
        )
      }
    }
    if (err instanceof DuplicateImportBatchError && normalizedHash) {
      const existing = await findImportBatchByFileHash(serviceSupabase, normalizedHash)
      if (existing) {
        return NextResponse.json({ batch: existing, duplicate: true }, { status: 200 })
      }
    }
    throw err
  }
})
