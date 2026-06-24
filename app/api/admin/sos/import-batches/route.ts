/**
 * GET  /api/admin/sos/import-batches — list bronze import batches
 * POST /api/admin/sos/import-batches — register a bronze CSV import (upload via [id]/upload)
 */

import { randomUUID, createHash } from 'crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import {
  createImportBatch,
  findImportBatchByFileHash,
  listImportBatches,
} from '@/lib/api/distributorImportBatches'
import { assertSettlementPeriodWritable } from '@/lib/api/settlementPeriods'
import { ApiError, withErrorHandler } from '@/lib/errors'

async function requireAdminOrEditor() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, 'Unauthorized')
  const role = await getUserRoleWithClient(supabase, user.id)
  if (!role || !['admin', 'editor'].includes(role)) throw new ApiError(403, 'Forbidden')
  return { user, supabase }
}

export const GET = withErrorHandler(async (): Promise<NextResponse> => {
  await requireAdminOrEditor()
  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batches = await listImportBatches(serviceSupabase, 100)
  return NextResponse.json({ batches })
})

const MAX_REGISTRATION_BODY_BYTES = 16_384

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { user } = await requireAdminOrEditor()

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
    row_count?: number
    file_size?: number
  }

  const {
    period_start,
    period_end,
    distributor,
    filename,
    file_hash,
    row_count,
  } = body

  if (!period_start || !period_end || !distributor || !filename) {
    throw new ApiError(400, 'period_start, period_end, distributor, and filename are required')
  }

  const serviceSupabase = await createServiceRoleSupabaseClient()

  if (file_hash && /^[a-f0-9]{64}$/i.test(file_hash)) {
    const existing = await findImportBatchByFileHash(serviceSupabase, file_hash)
    if (existing) {
      return NextResponse.json({ batch: existing, duplicate: true }, { status: 200 })
    }
  }

  const batchId = randomUUID()
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const hashPrefix = file_hash?.slice(0, 12) ?? createHash('sha256').update(`${batchId}-${filename}`).digest('hex').slice(0, 12)
  const r2Key = `sos-imports/${batchId}/${hashPrefix}_${safeName}`

  await assertSettlementPeriodWritable(serviceSupabase, period_start, period_end)

  const batch = await createImportBatch(serviceSupabase, {
    periodStart: period_start,
    periodEnd: period_end,
    distributor,
    r2Key,
    rowCount: row_count ?? 0,
    uploadedBy: user.id,
  })

  return NextResponse.json({ batch, r2Key }, { status: 201 })
})