/**
 * app/api/sync/artist/route.ts — Manual artist sync trigger
 *
 * POST /api/sync/artist
 * Body: { artistId: string }
 * Auth: ******
 *
 * Verifies the caller is authenticated, then runs the full multi-API sync
 * pipeline for the given artist via syncSingleArtist (iTunes, Spotify, Discogs,
 * concerts, Odesli — depending on configured env vars and artist IDs).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import type { Database } from '@/types/database'
import { syncSingleArtist } from '@/lib/sync/syncAll'
import { createSyncUploadFn } from '@/lib/r2Utils'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const { serverEnv } = await import('@/lib/env.server')

  const authHeader = request.headers.get('authorization') ?? ''
  const token = extractBearerToken(authHeader)
  await verifyAdmin(token)

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

export const GET = POST
