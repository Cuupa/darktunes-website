/**
 * app/api/admin/sos/period-summaries/route.ts
 *
 * GET  /api/admin/sos/period-summaries  — list historical period summaries
 * POST /api/admin/sos/period-summaries  — save a new period summary
 */

import { NextResponse } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, 'Unauthorized')
  const role = await getUserRoleWithClient(supabase, user.id)
  if (role !== 'admin') throw new ApiError(403, 'Forbidden')
  return supabase
}

export const GET = withErrorHandler(async (): Promise<NextResponse> => {
  const supabase = await requireAdmin()
  const { data, error } = await supabase
    .from('sos_period_summaries')
    .select('id, period_start, period_end, total_revenue, total_payout, artist_count, artist_breakdowns, platform_breakdowns, created_at')
    .order('period_start', { ascending: false })
  if (error) throw new ApiError(500, error.message)
  return NextResponse.json({ summaries: data ?? [] })
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const supabase = await requireAdmin()
  const body = await req.json()
  const {
    period_start, period_end, total_revenue, total_payout,
    artist_count, artist_breakdowns, platform_breakdowns,
  } = body as {
    period_start?: string; period_end?: string
    total_revenue?: number; total_payout?: number; artist_count?: number
    artist_breakdowns?: unknown[]; platform_breakdowns?: unknown[]
  }

  if (!period_start || !period_end) throw new ApiError(400, 'period_start and period_end are required')

  const { data, error } = await supabase
    .from('sos_period_summaries')
    .insert({
      period_start,
      period_end,
      total_revenue: total_revenue ?? 0,
      total_payout: total_payout ?? 0,
      artist_count: artist_count ?? 0,
      artist_breakdowns: artist_breakdowns ?? [],
      platform_breakdowns: platform_breakdowns ?? [],
    })
    .select()
    .single()
  if (error) throw new ApiError(500, error.message)
  return NextResponse.json({ summary: data }, { status: 201 })
})
