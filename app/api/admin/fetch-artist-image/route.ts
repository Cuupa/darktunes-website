/**
 * app/api/admin/fetch-artist-image/route.ts
 *
 * POST /api/admin/fetch-artist-image
 * Body: { spotifyId?: string; discogsId?: string }
 * Auth: Bearer <supabase-access-token> (admin or editor role required)
 *
 * Attempts to fetch the artist's profile image from Spotify (preferred) or
 * Discogs (fallback). Returns the first available high-resolution image URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { HttpError } from '@/lib/rateLimiter'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getSyncCredentials } from '@/lib/secrets/getExternalCredentials'

// ---------------------------------------------------------------------------
// Spotify helpers
// ---------------------------------------------------------------------------

async function getSpotifyAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!response.ok) {
    throw new HttpError(response.status, `Spotify auth failed: ${response.status}`)
  }
  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

async function fetchSpotifyArtistImage(
  spotifyId: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const token = await getSpotifyAccessToken(clientId, clientSecret)
  const response = await fetch(`https://api.spotify.com/v1/artists/${spotifyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) return null

  const data = (await response.json()) as { images: Array<{ url: string }> }
  return data.images?.[0]?.url ?? null
}

// ---------------------------------------------------------------------------
// Discogs helpers
// ---------------------------------------------------------------------------

async function fetchDiscogsArtistImage(
  discogsId: string,
  token: string | null,
): Promise<string | null> {
  const headers: Record<string, string> = {
    'User-Agent': 'darkTunes/1.0',
  }
  if (token) headers['Authorization'] = `Discogs token=${token}`

  const response = await fetch(`https://api.discogs.com/artists/${discogsId}`, { headers })
  if (!response.ok) return null

  const data = (await response.json()) as {
    images?: Array<{ uri: string; type: string }>
  }
  // Prefer primary image, fall back to any first image
  const primary = data.images?.find((img) => img.type === 'primary')
  return primary?.uri ?? data.images?.[0]?.uri ?? null
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  // 1. Authenticate — admin or editor role required
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_manage_artists')

  // 2. Parse body
  let spotifyId: string | undefined
  let discogsId: string | undefined
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null) {
      const b = body as Record<string, unknown>
      if (typeof b.spotifyId === 'string') spotifyId = b.spotifyId
      if (typeof b.discogsId === 'string') discogsId = b.discogsId
    }
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  if (!spotifyId && !discogsId) {
    throw new ApiError(400, 'Provide at least spotifyId or discogsId')
  }

  const db = await createServiceRoleSupabaseClient()
  const syncCredentials = await getSyncCredentials(db)
  const discogsToken = syncCredentials.discogsToken ?? null

  // 3. Try Spotify first, then Discogs
  let imageUrl: string | null = null

  if (spotifyId && syncCredentials.spotify) {
    try {
      const { clientId, clientSecret } = syncCredentials.spotify
      imageUrl = await fetchSpotifyArtistImage(spotifyId, clientId, clientSecret)
    } catch {
      // continue to Discogs fallback
    }
  }

  if (!imageUrl && discogsId) {
    try {
      imageUrl = await fetchDiscogsArtistImage(discogsId, discogsToken)
    } catch {
      // no image available
    }
  }

  if (!imageUrl) {
    throw new ApiError(404, 'No image found for this artist')
  }

  return NextResponse.json({ imageUrl })
})
