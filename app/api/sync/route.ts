/**
 * app/api/sync/route.ts — Manual "sync all artists" trigger
 *
 * POST /api/sync
 * Auth: ******
 *
 * Verifies the caller is authenticated, then runs syncAll() across every
 * artist and every configured external API (iTunes, Spotify, Discogs,
 * Songkick, Odesli).
 *
 * All business logic lives in src/lib/sync/syncAll.ts — this handler only
 * wires up real dependencies and delegates to withErrorHandler for error
 * handling.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import { timingSafeEqual } from 'node:crypto'
import type { Database } from '@/types/database'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { serverEnv } from '@/lib/env.server'
import { syncAll } from '@/lib/sync/syncAll'
import { createR2Client, uploadUrlToR2 } from '@/lib/r2Utils'

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

async function verifyToken(token: string): Promise<void> {
  const admin = createClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new ApiError(401, 'Unauthorized')
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  // 1. Authenticate — accept either a Vercel cron call or a user token
  const isCron = request.headers.get('x-vercel-cron') === '1'
  const authHeader = request.headers.get('authorization') ?? ''
  const { CRON_SECRET: cronSecret } = serverEnv
  if (isCron) {
    if (cronSecret && !isValidCronSecret(authHeader, cronSecret)) {
      throw new ApiError(401, 'Invalid cron secret')
    }
  } else {
    if (!authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Missing or invalid Authorization header')
    }
    await verifyToken(authHeader.slice(7))
  }

  // 2. Wire up dependencies (serverEnv validates all required vars at startup)
  const {
    CLOUDFLARE_R2_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    CLOUDFLARE_R2_BUCKET_NAME,
    CLOUDFLARE_R2_PUBLIC_URL,
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    DISCOGS_TOKEN,
    SONGKICK_API_KEY,
    BANDSINTOWN_API_KEY,
  } = serverEnv

  const db = createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const s3 = createR2Client(
    CLOUDFLARE_R2_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const uploadFn = (imageUrl: string, keyPrefix: string) =>
    uploadUrlToR2(imageUrl, s3, CLOUDFLARE_R2_BUCKET_NAME, CLOUDFLARE_R2_PUBLIC_URL, keyPrefix)

  // 3. Run sync (never throws — errors captured in SyncAllResult)
  const result = await syncAll({
    db,
    fetch: globalThis.fetch,
    uploadToR2: uploadFn,
    spotify:
      SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET
        ? { clientId: SPOTIFY_CLIENT_ID, clientSecret: SPOTIFY_CLIENT_SECRET }
        : undefined,
    discogsToken: DISCOGS_TOKEN,
    songkickApiKey: SONGKICK_API_KEY,
    bandsintownApiKey: BANDSINTOWN_API_KEY,
  })

  revalidateTag('releases')
  revalidateTag('artists')
  revalidateTag('concerts')
  return NextResponse.json(result)
})
