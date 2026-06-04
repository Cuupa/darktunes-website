/**
 * app/api/admin/enrich-artist-discogs/route.ts
 *
 * POST /api/admin/enrich-artist-discogs
 * Body: { discogsId: string }
 * Auth: Bearer <supabase-access-token>  (admin or editor role required)
 *
 * Fetches artist profile data from the Discogs API and returns it so the
 * admin can apply it to the artist record in the UI.  This endpoint does NOT
 * write to the database — it only returns the enrichment data; the admin UI
 * saves it via the normal artist update flow.
 *
 * Returns:
 *   { name, bio, imageUrl, urls }
 */

import { NextRequest, NextResponse } from 'next/server'
import { HttpError, withExponentialBackoff } from '@/lib/rateLimiter'
import { fetchDiscogsArtistProfile } from '@/lib/sync/discogsApi'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { extractDiscogsArtistId } from '@/lib/parsers/platformUrlParser'

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  // 1. Authenticate — admin or editor role required
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_manage_artists')

  // 2. Parse body
  let discogsId: string | undefined
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null && 'discogsId' in body) {
      discogsId = String((body as { discogsId: unknown }).discogsId).trim()
    }
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  if (!discogsId) {
    throw new ApiError(400, 'Missing required field: discogsId')
  }

  // Accept both numeric IDs and full Discogs artist URLs
  const numericId = extractDiscogsArtistId(discogsId)
  if (!numericId) {
    throw new ApiError(400, 'Invalid Discogs artist ID or URL. Provide a numeric ID or full Discogs artist URL.')
  }

  // 3. Fetch from Discogs
  // Direct process.env access: serverEnv validates all vars including R2,
  // but this route only needs the optional DISCOGS_TOKEN.
  const discogsToken = process.env.DISCOGS_TOKEN

  try {
    const profile = await withExponentialBackoff(() =>
      fetchDiscogsArtistProfile(numericId, discogsToken, globalThis.fetch),
    )

    return NextResponse.json({
      name: profile.name,
      bio: profile.bio,
      imageUrl: profile.imageUrl,
      urls: profile.urls,
    })
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof HttpError) {
      throw new ApiError(err.status >= 500 ? 502 : err.status, err.message)
    }
    throw err
  }
})
