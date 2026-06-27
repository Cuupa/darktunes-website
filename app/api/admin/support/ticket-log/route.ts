/**
 * GET /api/admin/support/ticket-log
 * Auth: admin only
 * Returns recent Zammad ticket submission audit entries.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { listTicketLog } from '@/lib/api/zammadSupport'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdmin(token)

  const limitParam = req.nextUrl.searchParams.get('limit')
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 200) : 50

  const db = await createServiceRoleSupabaseClient()
  const items = await listTicketLog(db, limit)

  return NextResponse.json({ items })
})