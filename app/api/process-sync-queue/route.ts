/**
 * app/api/process-sync-queue/route.ts — Async sync queue processor
 *
 * POST /api/process-sync-queue
 * Auth: Vercel Cron (x-vercel-cron: 1) or ******
 *
 * Picks the oldest pending job from sync_queue, processes it (syncs one
 * artist across all configured APIs), and marks it done or failed.
 *
 * Runs via Vercel Cron every 5 minutes (see vercel.json).
 * Each invocation processes exactly one job so the handler finishes within
 * Vercel's per-function timeout (maxDuration = 60s here — plenty for one
 * artist).
 *
 * Retry policy: failed jobs are re-queued with exponential backoff up to
 * MAX_ATTEMPTS (3) times, after which they are permanently marked 'failed'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import type { Database } from '@/types/database'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { claimNextSyncJob, markSyncJobDone, markSyncJobFailed } from '@/lib/api/syncQueue'
import { syncArtist } from '@/lib/sync/syncArtist'
import { createSyncUploadFn } from '@/lib/r2Utils'
import { isValidCronSecret } from '@/lib/cronAuth'

// One artist sync must finish within 60 seconds
export const maxDuration = 60

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const { serverEnv } = await import('@/lib/env.server')

  // Authenticate — accept Vercel cron header or CRON_SECRET bearer token
  const authHeader = request.headers.get('authorization') ?? ''
  const { CRON_SECRET: cronSecret } = serverEnv
  if (!cronSecret || !isValidCronSecret(authHeader, cronSecret)) {
    throw new ApiError(401, 'Unauthorized')
  }

  // Set up service-role DB client
  const db = createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  // Claim the next pending job (atomic — prevents double-processing)
  const job = await claimNextSyncJob(db)
  if (!job) {
    return NextResponse.json({ processed: false, message: 'No pending jobs in queue' })
  }

  if (!job.artistId) {
    await markSyncJobFailed(db, job.id, 'Job has no artist_id', job.attemptCount)
    return NextResponse.json({ processed: false, message: 'Job skipped: missing artist_id' })
  }

  // Set up R2 upload helper
  const uploadFn = createSyncUploadFn(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
    serverEnv.CLOUDFLARE_R2_PUBLIC_URL,
  )

  // Process the job — syncArtist never throws; errors go into result.errors
  try {
    const result = await syncArtist(job.artistId, {
      db,
      fetch: globalThis.fetch,
      uploadToR2: uploadFn,
    })

    if (result.errors && result.errors.length > 0) {
      // job.attemptCount reflects the incremented value after claimNextSyncJob
      await markSyncJobFailed(db, job.id, result.errors.join('; '), job.attemptCount)
    } else {
      await markSyncJobDone(db, job.id)
      revalidateTag('releases')
      revalidateTag('artists')
    }

    return NextResponse.json({
      processed: true,
      jobId: job.id,
      artistId: job.artistId,
      errors: result.errors ?? [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await markSyncJobFailed(db, job.id, message, job.attemptCount)
    return NextResponse.json({ processed: true, jobId: job.id, error: message }, { status: 500 })
  }
})
