import {NextRequest, NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'
import {revalidateTag} from 'next/cache'
import type {Database} from '@/types/database'
import {withErrorHandler, ApiError} from '@/lib/errors'
import {claimNextSyncJob, markSyncJobDone, markSyncJobFailed} from '@/lib/api/syncQueue'
import {syncArtist} from '@/lib/sync/syncArtist'
import {createSyncUploadFn} from '@/lib/r2Utils'
import {isValidCronSecret} from '@/lib/cronAuth'
import { waitUntil } from '@vercel/functions'

const TIME_BUDGET_MS = 50_000

export const maxDuration = 60

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
    const {serverEnv} = await import('@/lib/env.server')

    const authHeader = request.headers.get('authorization') ?? ''
    const force = request.headers.get('force') ?? ''

    const {CRON_SECRET: cronSecret} = serverEnv
    if (!cronSecret || !isValidCronSecret(authHeader, cronSecret)) {
        throw new ApiError(401, 'Unauthorized')
    }

    const db = createClient<Database>(
        serverEnv.NEXT_PUBLIC_SUPABASE_URL,
        serverEnv.SUPABASE_SERVICE_ROLE_KEY,
        {auth: {persistSession: false}},
    )

    const uploadFn = createSyncUploadFn(
        serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
        serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
        serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
        serverEnv.CLOUDFLARE_R2_PUBLIC_URL,
    )

    waitUntil((async () => {

        const startTime = Date.now()
        while (Date.now() - startTime < TIME_BUDGET_MS || force) {
            const job = await claimNextSyncJob(db)
            if (!job) {
                break
            }

            if (!job.artistId) {
                await markSyncJobFailed(db, job.id, 'Job has no artist_id', job.attemptCount)
                continue
            }

            try {
                const result = await syncArtist(job.artistId, {
                    db,
                    fetch: globalThis.fetch,
                    uploadToR2: uploadFn,
                })

                if (result.errors && result.errors.length > 0) {
                    await markSyncJobFailed(db, job.id, result.errors.join('; '), job.attemptCount)
                } else {
                    await markSyncJobDone(db, job.id)
                    revalidateTag('releases')
                    revalidateTag('artists')
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err)
                await markSyncJobFailed(db, job.id, message, job.attemptCount)
            }
        }
    })())

    return NextResponse.json( {accepted: true })
})
