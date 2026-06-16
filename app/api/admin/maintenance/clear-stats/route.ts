/**
 * app/api/admin/maintenance/clear-stats/route.ts
 *
 * POST /api/admin/maintenance/clear-stats
 * Body: { table: 'streaming_stats' | 'sos_period_summaries' }
 * Auth: admin only
 * Returns: { deleted: number }
 *
 * Deletes all rows from the specified statistics table. Validates the table
 * name against an allowlist to prevent arbitrary table deletion.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'

const ALLOWED_STATS_TABLES = [
  'streaming_stats',
  'sos_period_summaries',
] as const

type StatsTable = (typeof ALLOWED_STATS_TABLES)[number]

function isAllowedStatsTable(value: unknown): value is StatsTable {
  return ALLOWED_STATS_TABLES.includes(value as StatsTable)
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdmin(token)

  let table: unknown
  try {
    const body: unknown = await req.json()
    table = (body as Record<string, unknown>)?.table
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  if (!isAllowedStatsTable(table)) {
    throw new ApiError(400, 'Invalid table')
  }

  const db = await createServiceRoleSupabaseClient()

  // Delete all rows. PostgREST requires at least one filter on DELETE;
  // `not('id', 'is', null)` is equivalent to `WHERE id IS NOT NULL` which
  // matches every row since `id` is declared NOT NULL in all stats tables.
  const { data, error } = await db
    .from(table)
    .delete()
    .not('id', 'is', null)
    .select('id')

  if (error) throw new ApiError(500, `Failed to clear ${table}: ${error.message}`)

  return NextResponse.json({ deleted: (data ?? []).length })
})
