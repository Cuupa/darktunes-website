/**
 * app/api/admin/sos/period-summaries/route.ts
 *
 * GET  /api/admin/sos/period-summaries  — list historical period summaries
 * POST /api/admin/sos/period-summaries  — upsert a period summary (same path as Save to Portal)
 */

import { NextResponse } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import {
  listSosPeriodSummaries,
  upsertSosPeriodSummary,
  type SosPeriodSummary,
} from '@/lib/api/sosPeriodSummaries'
import { ApiError, withErrorHandler } from '@/lib/errors'

async function requireAccountingRole() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, 'Unauthorized')
  const role = await getUserRoleWithClient(supabase, user.id)
  if (!role || !['admin', 'editor'].includes(role)) throw new ApiError(403, 'Forbidden')
}

function summaryToApiRow(summary: SosPeriodSummary) {
  return {
    id: summary.id,
    period_start: summary.periodStart,
    period_end: summary.periodEnd,
    total_revenue: summary.totalRevenue,
    total_payout: summary.totalPayout,
    artist_count: summary.artistCount,
    artist_breakdowns: summary.artistBreakdowns,
    platform_breakdowns: summary.platformBreakdowns,
    source_batch_ids: summary.sourceBatchIds,
    created_at: summary.createdAt,
  }
}

export const GET = withErrorHandler(async (): Promise<NextResponse> => {
  await requireAccountingRole()
  const serviceSupabase = await createServiceRoleSupabaseClient()
  const summaries = await listSosPeriodSummaries(serviceSupabase)
  return NextResponse.json({ summaries: summaries.map(summaryToApiRow) })
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAccountingRole()
  const body = await req.json()
  const {
    period_start,
    period_end,
    total_revenue,
    total_payout,
    artist_count,
    artist_breakdowns,
    platform_breakdowns,
    source_batch_ids,
  } = body as {
    period_start?: string
    period_end?: string
    total_revenue?: number
    total_payout?: number
    artist_count?: number
    artist_breakdowns?: unknown[]
    platform_breakdowns?: unknown[]
    source_batch_ids?: string[]
  }

  if (!period_start || !period_end) {
    throw new ApiError(400, 'period_start and period_end are required')
  }

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const existing = (await listSosPeriodSummaries(serviceSupabase)).find(
    (s) => s.periodStart === period_start && s.periodEnd === period_end,
  )

  const mergedBatchIds = [
    ...new Set([...(existing?.sourceBatchIds ?? []), ...(source_batch_ids ?? [])]),
  ]

  const summary = await upsertSosPeriodSummary(serviceSupabase, {
    periodStart: period_start,
    periodEnd: period_end,
    totalRevenue: total_revenue ?? 0,
    totalPayout: total_payout ?? 0,
    artistCount: artist_count ?? 0,
    artistBreakdowns: artist_breakdowns ?? [],
    platformBreakdowns: platform_breakdowns ?? [],
    sourceBatchIds: mergedBatchIds,
  })

  return NextResponse.json(
    {
      summary: summaryToApiRow(summary),
      updated: Boolean(existing),
    },
    { status: existing ? 200 : 201 },
  )
})
