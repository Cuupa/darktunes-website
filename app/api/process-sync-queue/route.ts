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
import { timingSafeEqual } from 'node:crypto'
import type { Database } from '@/types/database'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { claimNextSyncJob, markSyncJobDone, markSyncJobFailed } from '@/lib/api/syncQueue'
import { syncArtist } from '@/lib/sync/syncArtist'
import { createR2Client, uploadUrlToR2 } from '@/lib/r2Utils'

// One artist sync must finish within 60 seconds
export const maxDuration = 60

function isValidCronSecret(authHeader: string, cronSecret: string): boolean {
  const expected = `Bearer ${cronSecret}`
  const authBuffer = Buffer.from(authHeader, 'utf-8')
  const expectedBuffer = Buffer.from(expected, 'utf-8')
  if (authBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(authBuffer, expectedBuffer)
}

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const { serverEnv } = await import('@/lib/env.server')

  // Authenticate — accept Vercel cron header or CRON_SECRET bearer token
  const isCron = request.headers.get('x-vercel-cron') === '1'
  const authHeader = request.headers.get('authorization') ?? ''
  const { CRON_SECRET: cronSecret } = serverEnv

  if (isCron) {
    if (!cronSecret || !isValidCronSecret(authHeader, cronSecret)) {
      throw new ApiError(401, 'Unauthorized')
    }
  } else {
    // Allow manual trigger from admin with a valid cron secret
    if (!cronSecret || !isValidCronSecret(authHeader, cronSecret)) {
      throw new ApiError(401, 'Unauthorized')
    }
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
  const {
    CLOUDFLARE_R2_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    CLOUDFLARE_R2_BUCKET_NAME,
    CLOUDFLARE_R2_PUBLIC_URL,
  } = serverEnv

  const s3 = createR2Client(
    CLOUDFLARE_R2_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const uploadFn = (imageUrl: string, keyPrefix: string) =>
    uploadUrlToR2(imageUrl, s3, CLOUDFLARE_R2_BUCKET_NAME, CLOUDFLARE_R2_PUBLIC_URL, keyPrefix)

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
