/**
 * app/api/admin/resolve-release-smart-link/route.ts
 *
 * POST /api/admin/resolve-release-smart-link
 * Body: { releaseId: string }
 * Auth: Bearer <supabase-access-token>  (admin or editor role required)
 *
 * Resolves an Odesli (song.link) smart URL for the given release and persists
 * it to releases.smart_url so it can be displayed on the public release detail
 * page.
 *
 * The Odesli API is free for up to ~10 req/s with no API key required.
 * See: https://odesli.co/
 *
 * Returns:
 *   { smartUrl: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { HttpError, withExponentialBackoff } from '@/lib/rateLimiter'
import { resolveOdesliSmartLink } from '@/lib/sync/odesliApi'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  // 1. Authenticate — admin or editor role required
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  // 2. Parse body
  let releaseId: string | undefined
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null && 'releaseId' in body) {
      releaseId = String((body as { releaseId: unknown }).releaseId).trim()
    }
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  if (!releaseId) {
    throw new ApiError(400, 'Missing required field: releaseId')
  }

  // 3. Load the release to get its Spotify URL
  // Dynamic import defers env validation to request time — consistent with upload route pattern.
  const { serverEnv } = await import('@/lib/env.server')

  const db = createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  const { data: releaseRow, error: releaseErr } = await db
    .from('releases')
    .select('id, spotify_url, apple_music_url, smart_url')
    .eq('id', releaseId)
    .single()

  if (releaseErr || !releaseRow) {
    throw new ApiError(404, 'Release not found')
  }

  // Prefer Spotify URL; fall back to Apple Music
  const musicUrl = releaseRow.spotify_url ?? releaseRow.apple_music_url
  if (!musicUrl) {
    throw new ApiError(422, 'Release has no Spotify or Apple Music URL to resolve')
  }

  // 4. Resolve smart link via Odesli
  try {
    const result = await withExponentialBackoff(() =>
      resolveOdesliSmartLink(musicUrl, globalThis.fetch),
    )

    // 5. Persist smart_url back to the release
    const { error: updateErr } = await db
      .from('releases')
      .update({ smart_url: result.smartUrl })
      .eq('id', releaseId)

    if (updateErr) {
      throw new ApiError(500, updateErr.message)
    }

    return NextResponse.json({ smartUrl: result.smartUrl })
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof HttpError) {
      throw new ApiError(err.status >= 500 ? 502 : err.status, err.message)
    }
    throw err
  }
})
