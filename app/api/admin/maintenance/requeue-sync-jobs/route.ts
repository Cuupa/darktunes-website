/**
 * app/api/admin/maintenance/requeue-sync-jobs/route.ts
 *
 * POST /api/admin/maintenance/requeue-sync-jobs
 * Auth: admin only
 * Returns: { requeued: number }
 *
 * Resets permanently failed sync_queue jobs back to pending so the cron
 * executor can retry them.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { requeueFailedSyncJobs } from '@/lib/api/syncQueue'

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdmin(token)

  const db = await createServiceRoleSupabaseClient()
  const requeued = await requeueFailedSyncJobs(db)

  return NextResponse.json({ requeued })
})