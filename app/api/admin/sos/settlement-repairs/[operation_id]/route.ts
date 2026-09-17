/**
 * GET /api/admin/sos/settlement-repairs/{operation_id}
 *
 * Reads a stored repair run (including its restore artifact) from the durable
 * `settlement_operations` journal.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdminFromRequest } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { getSettlementOperationById } from '@/lib/api/settlementOperations'
import { REPAIR_OPERATION_TYPE } from '@/lib/api/settlementRepair'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdminFromRequest(req)

  const operationId = req.nextUrl.pathname.split('/').pop()
  if (!operationId) throw new ApiError(400, 'Missing operation id')

  const db = await createServiceRoleSupabaseClient()
  const operation = await getSettlementOperationById(db, operationId)
  if (!operation || operation.operationType !== REPAIR_OPERATION_TYPE) {
    throw new ApiError(404, 'Repair run not found')
  }

  return NextResponse.json({
    operation_id: operation.id,
    plan_hash: operation.payloadHash,
    status: operation.status,
    created_at: operation.createdAt,
    updated_at: operation.updatedAt,
    result: operation.result,
  })
})
