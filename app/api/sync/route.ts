import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import type { Database } from '@/types/database'
import {
  claimNextSyncJob,
  markSyncJobDone,
  markSyncJobFailed,
  rescheduleSyncJob,
} from '@/lib/api/syncQueue'
import { createSyncUploadFn } from '@/lib/r2Utils'
import { isValidCronSecret } from '@/lib/cronAuth'
import { waitUntil } from '@vercel/functions'
import { syncOdesliBatch, syncSingleArtist } from '@/lib/sync/syncAll'
import { RATE_LIMIT_JOB_COOLDOWN_MS, isRateLimitedSyncError } from '@/lib/sync/retryPolicy'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { withErrorHandler } from '@/lib/errors'
import { recordHealthHeartbeat } from '@/lib/health/heartbeats'
import { getSyncCredentials } from '@/lib/secrets/getExternalCredentials'

const TIME_BUDGET_MS = 50_000

export const maxDuration = 60

async function processSyncJob(
  db: ReturnType<typeof createClient<Database>>,
  job: Awaited<ReturnType<typeof claimNextSyncJob>>,
  uploadFn: ReturnType<typeof createSyncUploadFn>,
  syncCredentials: Awaited<ReturnType<typeof getSyncCredentials>>,
): Promise<void> {
  if (!job) return

  const deps = {
    db,
    fetch: globalThis.fetch,
    uploadToR2: uploadFn,
    spotify: syncCredentials.spotify,
    discogsToken: syncCredentials.discogsToken,
    songkickApiKey: syncCredentials.songkickApiKey,
    bandsintownApiKey: syncCredentials.bandsintownApiKey,
  }

  if (job.jobType === 'odesli') {
    const result = await syncOdesliBatch(deps)
    const odesliResult = result.results.find((r) => r.api === 'odesli')
    const rateLimited = odesliResult?.rateLimited ?? false
    const hasMoreWork = odesliResult?.hasMoreWork ?? false

    if (hasMoreWork || rateLimited) {
      await rescheduleSyncJob(
        db,
        job.id,
        rateLimited ? RATE_LIMIT_JOB_COOLDOWN_MS : 0,
        rateLimited
          ? { undoAttemptIncrement: true, currentAttemptCount: job.attemptCount }
          : undefined,
      )
    } else {
      await markSyncJobDone(db, job.id)
    }

    revalidateTag('releases', 'max')
    revalidateTag('artists', 'max')
    return
  }

  if (!job.artistId) {
    await markSyncJobFailed(db, job.id, 'Job has no artist_id', job.attemptCount)
    return
  }

  const result = await syncSingleArtist(job.artistId, job.jobType, deps)
  const rateLimited = result.results.some((r) => r.rateLimited)

  if (rateLimited) {
    await rescheduleSyncJob(db, job.id, RATE_LIMIT_JOB_COOLDOWN_MS, {
      undoAttemptIncrement: true,
      currentAttemptCount: job.attemptCount,
    })
  } else {
    await markSyncJobDone(db, job.id)
  }

  revalidateTag('releases', 'max')
  revalidateTag('artists', 'max')
  revalidateTag('concerts', 'max')
}

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const { serverEnv } = await import('@/lib/env.server')

  const authHeader = request.headers.get('authorization') ?? ''
  const force = request.headers.get('force') ?? ''

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

  const syncCredentials = await getSyncCredentials(db)

  void recordHealthHeartbeat(db, 'sync_execute')

  const uploadFn = createSyncUploadFn(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
    serverEnv.CLOUDFLARE_R2_PUBLIC_URL,
  )

  waitUntil((async () => {
    const startTime = Date.now()
    while (Date.now() - startTime < TIME_BUDGET_MS || force === '1') {
      const job = await claimNextSyncJob(db)
      if (!job) break

      try {
        await processSyncJob(db, job, uploadFn, syncCredentials)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await markSyncJobFailed(db, job.id, message, job.attemptCount, {
          rateLimited: isRateLimitedSyncError(err),
        })
      }
    }
  })())

  return NextResponse.json({ accepted: true })
})

export const GET = POST