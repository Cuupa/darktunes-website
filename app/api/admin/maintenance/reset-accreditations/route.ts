/**
 * app/api/admin/maintenance/reset-accreditations/route.ts
 *
 * POST /api/admin/maintenance/reset-accreditations
 * Auth: admin only
 * Returns: { updated: number }
 *
 * Resets all `accreditation_requests` rows to `status = 'pending'`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'

export const POST = withErrorHandler(async (_req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(_req.headers.get('authorization'))
  await verifyAdmin(token)

  const db = await createServiceRoleSupabaseClient()

  const { data, error } = await db
    .from('accreditation_requests')
    .update({ status: 'pending' })
    .not('status', 'eq', 'pending')
    .select('id')

  if (error) throw new ApiError(500, `Failed to reset accreditations: ${error.message}`)

  return NextResponse.json({ updated: (data ?? []).length })
})
