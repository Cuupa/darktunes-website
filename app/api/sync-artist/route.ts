/**
 * app/api/sync-artist/route.ts — Manual artist sync trigger
 *
 * POST /api/sync-artist
 * Body: { artistId: string }
 * Auth: Bearer token
 *
 * Verifies the caller is authenticated, then runs the full multi-API sync
 * pipeline for the given artist via syncSingleArtist (iTunes, Spotify, Discogs,
 * concerts, Odesli — depending on configured env vars and artist IDs).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import type { Database } from '@/types/database'
import type { ServerEnv } from '@/lib/env.server'
import { syncSingleArtist } from '@/lib/sync/syncAll'
import { createSyncUploadFn } from '@/lib/r2Utils'
import { ApiError, buildApiError, withErrorHandler } from '@/lib/errors'

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function verifyToken(token: string, env: ServerEnv): Promise<string> {
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw buildApiError('AUTH_TOKEN_INVALID', 401)
  return data.user.id
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const { serverEnv } = await import('@/lib/env.server')

  // 1. Authenticate
  const authHeader = request.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    throw buildApiError('AUTH_TOKEN_MISSING', 401)
  }
  await verifyToken(authHeader.slice(7), serverEnv)

  // 2. Parse body
  let artistId: string | undefined
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null && 'artistId' in body) {
      artistId = String((body as { artistId: unknown }).artistId)
    }
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  if (!artistId) {
    throw new ApiError(400, 'Missing required field: artistId')
  }

  const {
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    DISCOGS_TOKEN,
    SONGKICK_API_KEY,
    BANDSINTOWN_API_KEY,
  } = process.env

  // 3. Wire up dependencies
  const db = createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  const uploadFn = createSyncUploadFn(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
    serverEnv.CLOUDFLARE_R2_PUBLIC_URL,
  )

  // 4. Run full multi-API sync for this artist (never throws — errors in SyncAllResult)
  const result = await syncSingleArtist(artistId, 'full', {
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