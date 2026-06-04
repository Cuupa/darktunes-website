/**
 * app/api/admin/rbac-audit/route.ts
 *
 * GET /api/admin/rbac-audit
 * Returns paginated RBAC audit log entries. Admin only.
 *
 * Query params:
 *   page      — 0-based page index (default 0)
 *   pageSize  — rows per page (default 20, max 100)
 *   action    — filter by action string (optional)
 *   targetType — filter by target_type (optional)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdmin(token)

  const { searchParams } = new URL(req.url)
  const page      = Math.max(0, parseInt(searchParams.get('page')     ?? '0', 10))
  const pageSize  = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)))
  const action    = searchParams.get('action')     ?? ''
  const targetType = searchParams.get('targetType') ?? ''

  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('rbac_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (action)     query = query.eq('action', action)
  if (targetType) query = query.eq('target_type', targetType)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, pageSize })
})
