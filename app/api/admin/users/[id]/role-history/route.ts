import { requireAdminFromRequest, requireAdminWithServiceClient } from '@/lib/adminAuth'
/**
 * app/api/admin/users/[id]/role-history/route.ts
 *
 * GET /api/admin/users/:id/role-history
 * Returns role-change and ban-action audit history for a specific user.
 *
 * Security: only admin users may call this endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { getRoleHistory, getBanHistory } from '@/lib/api/users'

function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  // URL: /api/admin/users/:id/role-history → second-to-last segment is :id
  return segments[segments.length - 2]
}

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  // 1. Auth + admin check
  await requireAdminFromRequest(req)

  // 2. Fetch history
  const targetId = extractId(req)
  const adminClient = await createServiceRoleSupabaseClient()

  const [roleChanges, banHistory] = await Promise.all([
    getRoleHistory(adminClient, targetId),
    getBanHistory(adminClient, targetId),
  ])

  return NextResponse.json({ roleChanges, banHistory })
})
