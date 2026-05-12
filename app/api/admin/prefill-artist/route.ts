import { NextRequest, NextResponse } from 'next/server'
import { HttpError, withExponentialBackoff } from '@/lib/rateLimiter'
import { fetchSpotifyArtistProfile } from '@/lib/sync/spotifyApi'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'

interface PrefillResponse {
  spotifyId: string
  name: string
  imageUrl: string | null
  genres: string[]
  spotifyUrl: string
}

function extractSpotifyArtistId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^[A-Za-z0-9]+$/.test(trimmed)) return trimmed

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    if (parsed.hostname.toLowerCase() !== 'open.spotify.com') return null

    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts[0] === 'artist' && parts[1] && /^[A-Za-z0-9]+$/.test(parts[1])) {
      return parts[1]
    }
  } catch {
    return null
  }

  return null
}

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  // 1. Authenticate — admin or editor role required
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyAdminOrEditor(token)

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

  // Dynamic import defers validation — note: we only need SPOTIFY vars here but
  // keep direct process.env access to avoid requiring R2 vars (serverEnv validates all).
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new ApiError(503, 'Spotify is not configured')
  }

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
