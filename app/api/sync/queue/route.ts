
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifySyncTrigger } from '@/lib/adminAuth'
import { isValidCronSecret } from '@/lib/cronAuth'
import { enqueueArtistSyncJobs } from '@/lib/api/syncQueue'
import { recordHealthHeartbeat } from '@/lib/health/heartbeats'
// Route-segment config: allow up to 300 seconds on Vercel Pro.
export const maxDuration = 300

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
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

  // 2. Load all artist IDs
    const db = createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  const { data: artists, error: artistsError } = await db
    .from('artists')
    .select('id')
    .order('name', { ascending: true })

  if (artistsError) {
    throw new ApiError(500, 'Failed to load artists: ' + artistsError.message)
  }

  const artistIds = (artists ?? []).map((a) => a.id)

  const queued = await enqueueArtistSyncJobs(db, artistIds, 'full')
  await recordHealthHeartbeat(db, 'sync_queue')

  return NextResponse.json({
    queued,
    total: artistIds.length,
    message: queued + ' sync job(s) enqueued.',
  })
})

export const GET = POST
