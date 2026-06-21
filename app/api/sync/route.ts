/**
 * app/api/sync/route.ts — Manual "sync all artists" trigger
 *
 * POST /api/sync
 * Auth: Supabase session token (Bearer) or Vercel Cron (x-vercel-cron: 1)
 *
 * Enqueues async sync jobs for every artist in the database into the
 * sync_queue table. The actual per-artist processing runs in small chunks
 * via POST /api/process-sync-queue (Vercel cron: every 5 minutes) so that no
 * single request exceeds Vercel's timeout limits.
 *
 * This endpoint returns immediately after enqueuing — it does not wait for
 * the sync to complete. The Admin Health dashboard shows queue progress.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import type { Database } from '@/types/database'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { enqueueArtistSyncJobs } from '@/lib/api/syncQueue'
import type { ServerEnv } from '@/lib/env.server'

// Route-segment config: allow up to 300 seconds on Vercel Pro.
export const maxDuration = 300

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function isValidCronSecret(authHeader: string, cronSecret: string): boolean {
  const expected = `Bearer ${cronSecret}`
  const authBuffer = Buffer.from(authHeader, 'utf-8')
  const expectedBuffer = Buffer.from(expected, 'utf-8')
  if (authBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(authBuffer, expectedBuffer)
}

async function verifyToken(token: string, env: ServerEnv): Promise<void> {
  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new ApiError(401, 'Unauthorized')
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const { serverEnv } = await import('@/lib/env.server')

  // 1. Authenticate — accept either a Vercel cron call or a user token
  const isCron = request.headers.get('x-vercel-cron') === '1'
  const authHeader = request.headers.get('authorization') ?? ''
  const { CRON_SECRET: cronSecret } = serverEnv
  if (isCron) {
    if (!cronSecret || !isValidCronSecret(authHeader, cronSecret)) {
      throw new ApiError(401, 'Unauthorized')
    }
  } else {
    if (!authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Missing or invalid Authorization header')
    }
    await verifyToken(authHeader.slice(7), serverEnv)
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

  // 3. Enqueue one job per artist (skips artists already queued)
  const queued = await enqueueArtistSyncJobs(db, artistIds, 'full')

  return NextResponse.json({
    queued,
    total: artistIds.length,
    message: queued + ' sync job(s) enqueued. Processing runs via cron every 5 minutes.',
  })
})
