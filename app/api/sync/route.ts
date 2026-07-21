import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  claimNextSyncJob,
  markSyncJobDone,
  markSyncJobFailed,
  rescheduleSyncJob,
  type SyncJobType,
} from '@/lib/api/syncQueue'
import { createSyncUploadFn } from '@/lib/r2Utils'
import { isValidCronSecret } from '@/lib/cronAuth'
import { waitUntil } from '@vercel/functions'
import { syncOdesliBatch, syncSingleArtist } from '@/lib/sync/syncAll'
import { RATE_LIMIT_JOB_COOLDOWN_MS, isRateLimitedSyncError } from '@/lib/sync/retryPolicy'
import { extractBearerToken, verifySyncTrigger } from '@/lib/adminAuth'
import { withErrorHandler } from '@/lib/errors'
import { recordHealthHeartbeat } from '@/lib/health/heartbeats'
import { getSyncCredentials } from '@/lib/secrets/getExternalCredentials'
import {
  revalidatePublicContent,
  RELEASE_SYNC_TAGS,
  type PublicContentTag,
} from '@/lib/sync/revalidatePublicContent'

const TIME_BUDGET_MS = 50_000

export const maxDuration = 60

function tagsForJobType(jobType: SyncJobType): PublicContentTag[] {
  // YouTube channel sync is a separate route; artist-scoped "youtube" jobs fall
  // through to full artist sync (releases/concerts) as a legacy fallback.
  if (jobType === 'odesli') return ['releases', 'artists']
  return [...RELEASE_SYNC_TAGS]
}

async function processSyncJob(
  db: ReturnType<typeof createClient<Database>>,
  job: NonNullable<Awaited<ReturnType<typeof claimNextSyncJob>>>,
  uploadFn: ReturnType<typeof createSyncUploadFn>,
  syncCredentials: Awaited<ReturnType<typeof getSyncCredentials>>,
): Promise<PublicContentTag[]> {
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

    return tagsForJobType('odesli')
  }

  if (!job.artistId) {
    await markSyncJobFailed(db, job.id, 'Job has no artist_id', job.attemptCount)
    return []
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

  return tagsForJobType(job.jobType)
}

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const { serverEnv } = await import('@/lib/env.server')

  const authHeader = request.headers.get('authorization') ?? ''
  const force = request.headers.get('force') ?? ''

  const { CRON_SECRET: cronSecret } = serverEnv
  const isCronAuthorized = Boolean(cronSecret && isValidCronSecret(authHeader, cronSecret))

  if (!isCronAuthorized) {
    const token = extractBearerToken(authHeader)
    await verifySyncTrigger(token)
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

  waitUntil(
    (async () => {
      const startTime = Date.now()
      const tagsToRevalidate = new Set<PublicContentTag>()
      let jobsProcessed = 0

      while (Date.now() - startTime < TIME_BUDGET_MS || force === '1') {
        const job = await claimNextSyncJob(db)
        if (!job) break

        try {
          const tags = await processSyncJob(db, job, uploadFn, syncCredentials)
          for (const tag of tags) tagsToRevalidate.add(tag)
          jobsProcessed += 1
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          await markSyncJobFailed(db, job.id, message, job.attemptCount, {
            rateLimited: isRateLimitedSyncError(err),
          })
          // Still bust caches — partial writes may have landed before the throw.
          for (const tag of tagsForJobType(job.jobType)) tagsToRevalidate.add(tag)
          jobsProcessed += 1
        }
      }

      // Single end-of-batch revalidation is more reliable inside waitUntil than
      // revalidateTag calls scattered mid-loop (and covers path-level ISR).
      if (jobsProcessed > 0 && tagsToRevalidate.size > 0) {
        revalidatePublicContent([...tagsToRevalidate])
      }
    })(),
  )

  return NextResponse.json({ accepted: true })
})

export const GET = POST
