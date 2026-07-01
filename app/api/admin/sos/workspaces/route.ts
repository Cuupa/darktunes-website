/**
 * GET  /api/admin/sos/workspaces?periodStart=...&periodEnd=... — load workspace for period
 * POST /api/admin/sos/workspaces — upsert workspace (rules config + bronze batches) for a period
 *
 * Provides the enterprise shared state for accounting configuration.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import {
  deleteWorkspaceForPeriod,
  getWorkspaceForPeriod,
  upsertWorkspaceForPeriod,
  type AccountingWorkspaceConfig,
} from '@/lib/api/sosAccountingWorkspaces'
import { assertSettlementPeriodWritable } from '@/lib/api/settlementPeriods'
import { ApiError, withErrorHandler } from '@/lib/errors'

async function requireAccountingRole() {
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

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAccountingRole()

  const periodStart = req.nextUrl.searchParams.get('periodStart')
  const periodEnd = req.nextUrl.searchParams.get('periodEnd')

  if (!periodStart || !periodEnd) {
    throw new ApiError(400, 'periodStart and periodEnd are required')
  }

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const workspace = await getWorkspaceForPeriod(serviceSupabase, periodStart, periodEnd)

  return NextResponse.json({ workspace })
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { user } = await requireAccountingRole()
  const body = await req.json()

  const {
    period_start,
    period_end,
    config,
    bronze_batch_ids,
  } = body as {
    period_start?: string
    period_end?: string
    config?: AccountingWorkspaceConfig
    bronze_batch_ids?: string[]
  }

  if (!period_start || !period_end) {
    throw new ApiError(400, 'period_start and period_end are required')
  }
  if (!config || typeof config !== 'object') {
    throw new ApiError(400, 'config (rules bundle) is required')
  }

  const serviceSupabase = await createServiceRoleSupabaseClient()

  // Respect period locking when present
  await assertSettlementPeriodWritable(serviceSupabase, period_start, period_end)

  const workspace = await upsertWorkspaceForPeriod(serviceSupabase, {
    periodStart: period_start,
    periodEnd: period_end,
    config,
    bronzeBatchIds: bronze_batch_ids ?? [],
    updatedBy: user.id,
  })

  return NextResponse.json({ workspace }, { status: 200 })
})

export const DELETE = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAccountingRole()

  const periodStart = req.nextUrl.searchParams.get('periodStart')
  const periodEnd = req.nextUrl.searchParams.get('periodEnd')

  if (!periodStart || !periodEnd) {
    throw new ApiError(400, 'periodStart and periodEnd are required')
  }

  const serviceSupabase = await createServiceRoleSupabaseClient()
  await assertSettlementPeriodWritable(serviceSupabase, periodStart, periodEnd)

  const deleted = await deleteWorkspaceForPeriod(serviceSupabase, periodStart, periodEnd)

  return NextResponse.json({ deleted })
})
