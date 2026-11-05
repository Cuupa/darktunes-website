/**
 * app/api/sync/queue/route.ts
 *
 * POST — enqueue full artist sync jobs for every artist
 * GET  — return current queue stats (pending/running/done/failed)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifySyncTrigger } from '@/lib/adminAuth'
import { isValidCronSecret } from '@/lib/cronAuth'
import { enqueueArtistSyncJobs, getSyncQueueStats, scheduleDueArtistSyncJobs, type SyncJobType } from '@/lib/api/syncQueue'
import { recordHealthHeartbeat } from '@/lib/health/heartbeats'

// Route-segment config: allow up to 300 seconds on Vercel Pro.
export const maxDuration = 300

async function authorizeSyncRequest(request: NextRequest): Promise<boolean> {
  const { serverEnv } = await import('@/lib/env.server')
  const authHeader = request.headers.get('authorization') ?? ''
  const { CRON_SECRET: cronSecret } = serverEnv

  if (!authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid Authorization header')
  }
  const isCronAuthorized = Boolean(cronSecret && isValidCronSecret(authHeader, cronSecret))

  if (!isCronAuthorized) {
    const token = extractBearerToken(authHeader)
    await verifySyncTrigger(token)
  }
  return isCronAuthorized
}

function createServiceDb(
  serverEnv: Awaited<typeof import('@/lib/env.server')>['serverEnv'],
) {
  return createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const automated = await authorizeSyncRequest(request)
  const { serverEnv } = await import('@/lib/env.server')
  const db = createServiceDb(serverEnv)

  if (automated) {
    // Cron schedules only providers that are due. Stable artist/provider jitter
    // spreads the first sync over a day; later runs honor stored checkpoints.
    const queued = await scheduleDueArtistSyncJobs(db, 100)
    await recordHealthHeartbeat(db, 'queue')
    return NextResponse.json({ queued, mode: 'scheduled', message: queued + ' due provider jobs queued.' })
  }

  // An administrator's full sync also uses provider-specific jobs, never a
  // giant synchronous Promise.all over the whole catalogue.
  const { data: artists, error: artistsError } = await db
    .from('artists')
    .select('id, spotify_id, discogs_id, songkick_id, bandsintown_id')
    .order('name', { ascending: true })
  if (artistsError) throw new ApiError(500, 'Failed to load artists: ' + artistsError.message)

  const rows = artists ?? []
  const sources: Array<{ provider: SyncJobType; ids: string[] }> = [
    { provider: 'itunes', ids: rows.map((row) => row.id) },
    { provider: 'spotify', ids: rows.filter((row) => row.spotify_id).map((row) => row.id) },
    { provider: 'discogs', ids: rows.filter((row) => row.discogs_id).map((row) => row.id) },
    { provider: 'songkick', ids: rows.filter((row) => row.songkick_id).map((row) => row.id) },
    { provider: 'bandsintown', ids: rows.filter((row) => row.bandsintown_id).map((row) => row.id) },
  ]
  const queuedByProvider: Record<string, number> = {}
  for (const source of sources) {
    queuedByProvider[source.provider] = await enqueueArtistSyncJobs(db, source.ids, source.provider)
  }
  const queued = Object.values(queuedByProvider).reduce((sum, value) => sum + value, 0)
  await recordHealthHeartbeat(db, 'queue')
  return NextResponse.json({
    queued,
    totalArtists: rows.length,
    queuedByProvider,
    mode: 'manual',
    message: queued + ' provider-specific sync job(s) enqueued.',
  })
})

/** Queue depth for admin polling after enqueue (does not enqueue). */
export const GET = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  await authorizeSyncRequest(request)
  const { serverEnv } = await import('@/lib/env.server')
  const db = createServiceDb(serverEnv)
  const stats = await getSyncQueueStats(db)
  return NextResponse.json(stats)
})
