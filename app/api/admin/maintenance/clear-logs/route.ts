/**
 * app/api/admin/maintenance/clear-logs/route.ts
 *
 * POST /api/admin/maintenance/clear-logs
 * Body: { table: 'app_logs' | 'sync_logs' | 'rbac_audit_log' | 'admin_audit_log' }
 * Auth: admin only
 * Returns: { deleted: number }
 *
 * Deletes all rows from the specified log table. Validates the table name
 * against an allowlist to prevent arbitrary table deletion.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { logAdminActionForRequest } from '@/lib/adminAuditLog'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
const ALLOWED_LOG_TABLES = [
  'app_logs',
  'sync_logs',
  'rbac_audit_log',
  'admin_audit_log',
] as const

type LogTable = (typeof ALLOWED_LOG_TABLES)[number]

function isAllowedLogTable(value: unknown): value is LogTable {
  return ALLOWED_LOG_TABLES.includes(value as LogTable)
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const actorId = await verifyAdmin(token)

  let table: unknown
  try {
    const body: unknown = await req.json()
    table = (body as Record<string, unknown>)?.table
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  if (!isAllowedLogTable(table)) {
    throw new ApiError(400, 'Invalid table')
  }

  const db = await createServiceRoleSupabaseClient()

  // Deleted count comes from the DB (clear_log_table), so the response never
  // has to materialise every deleted id — safe on very large log tables.
  const { data, error } = await db.rpc('clear_log_table', { p_table: table })

  if (error) throw new ApiError(500, `Failed to clear ${table}: ${error.message}`)

  const deleted = typeof data === 'number' ? data : Number(data ?? 0)

  await logAdminActionForRequest(req, db, {
    actorId,
    action: 'cleared',
    resource: table,
    details: { deleted },
  })

  return NextResponse.json({ deleted })
})
