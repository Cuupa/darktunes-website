/**
 * app/api/sync/requeue/route.ts
 *
 * POST /api/sync/requeue
 * Auth: admin JWT or CRON_SECRET
 * Returns: { requeued: number }
 *
 * Resets permanently failed sync_queue jobs back to pending so the sync
 * executor can retry them. This is also safe to trigger from cron.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { withErrorHandler } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { requeueFailedSyncJobs } from '@/lib/api/syncQueue'
import { isValidCronSecret } from '@/lib/cronAuth'

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { serverEnv } = await import('@/lib/env.server')

  const authHeader = req.headers.get('authorization') ?? ''
  const { CRON_SECRET: cronSecret } = serverEnv
  const isCronAuthorized = Boolean(cronSecret && isValidCronSecret(authHeader, cronSecret))

  if (!isCronAuthorized) {
    const token = extractBearerToken(authHeader)
    await verifyAdmin(token)
  }

  const db = createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
  const requeued = await requeueFailedSyncJobs(db)

  return NextResponse.json({ requeued })
})

export const GET = POST
