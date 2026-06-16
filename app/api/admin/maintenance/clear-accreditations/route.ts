/**
 * app/api/admin/maintenance/clear-accreditations/route.ts
 *
 * POST /api/admin/maintenance/clear-accreditations
 * Auth: admin only
 * Returns: { deleted: number }
 *
 * Permanently deletes ALL rows from `accreditation_requests`.
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
    .delete()
    .not('id', 'is', null)
    .select('id')

  if (error) throw new ApiError(500, `Failed to clear accreditations: ${error.message}`)

  return NextResponse.json({ deleted: (data ?? []).length })
})
