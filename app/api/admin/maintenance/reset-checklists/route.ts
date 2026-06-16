/**
 * app/api/admin/maintenance/reset-checklists/route.ts
 *
 * POST /api/admin/maintenance/reset-checklists
 * Auth: admin only
 * Returns: { updated: number }
 *
 * Sets `is_completed = false` for every row in `release_checklists`.
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
    .from('release_checklists')
    .update({ is_completed: false })
    .eq('is_completed', true)
    .select('id')

  if (error) throw new ApiError(500, `Failed to reset checklists: ${error.message}`)

  return NextResponse.json({ updated: (data ?? []).length })
})
