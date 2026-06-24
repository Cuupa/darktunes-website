import { NextRequest, NextResponse } from 'next/server'
import { HttpError, withExponentialBackoff } from '@/lib/rateLimiter'
import { fetchSpotifyArtistProfile } from '@/lib/sync/spotifyApi'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { extractSpotifyArtistId } from '@/lib/parsers/platformUrlParser'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getSyncCredentials } from '@/lib/secrets/getExternalCredentials'

interface PrefillResponse {
  spotifyId: string
  name: string
  imageUrl: string | null
  genres: string[]
  spotifyUrl: string
}

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  // 1. Authenticate — admin or editor role required
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_manage_artists')

  let spotifyUrl: string | undefined
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null && 'spotifyUrl' in body) {
      spotifyUrl = String((body as { spotifyUrl: unknown }).spotifyUrl)
    }
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  if (!spotifyUrl) {
    throw new ApiError(400, 'Missing required field: spotifyUrl')
  }

  const spotifyArtistId = extractSpotifyArtistId(spotifyUrl)
  if (!spotifyArtistId) {
    throw new ApiError(400, 'Invalid Spotify artist URL or ID')
  }

  const db = await createServiceRoleSupabaseClient()
  const { spotify } = await getSyncCredentials(db)
  if (!spotify) {
    throw new ApiError(503, 'Spotify is not configured in Admin → API Keys')
  }
  const { clientId, clientSecret } = spotify

  try {
    const profile = await withExponentialBackoff(() =>
      fetchSpotifyArtistProfile(spotifyArtistId, clientId, clientSecret, globalThis.fetch),
    )

    const response: PrefillResponse = {
      spotifyId: profile.spotifyId,
      name: profile.name,
      imageUrl: profile.imageUrl,
      genres: profile.genres,
      spotifyUrl: profile.spotifyUrl,
    }

    return NextResponse.json(response)
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof HttpError) {
      throw new ApiError(err.status >= 500 ? 502 : err.status, err.message)
    }
    throw err
  }
})
