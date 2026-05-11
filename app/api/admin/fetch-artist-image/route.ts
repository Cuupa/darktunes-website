/**
 * app/api/admin/fetch-artist-image/route.ts
 *
 * POST /api/admin/fetch-artist-image
 * Body: { spotifyId?: string; discogsId?: string }
 * Auth: Bearer <supabase-access-token>
 *
 * Attempts to fetch the artist's profile image from Spotify (preferred) or
 * Discogs (fallback). Returns the first available high-resolution image URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { HttpError } from '@/lib/rateLimiter'

// ---------------------------------------------------------------------------
// Auth helper (same pattern as sync-artist route)
// ---------------------------------------------------------------------------

async function verifyToken(token: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase service key not configured')

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new Error('Unauthorized')
}

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

async function fetchSpotifyArtistImage(spotifyId: string): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

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

async function fetchDiscogsArtistImage(discogsId: string): Promise<string | null> {
  const token = process.env.DISCOGS_TOKEN
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Authenticate
  const authHeader = request.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
  }

  try {
    await verifyToken(authHeader.slice(7))
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!spotifyId && !discogsId) {
    return NextResponse.json({ error: 'Provide at least spotifyId or discogsId' }, { status: 400 })
  }

  // 3. Try Spotify first, then Discogs
  let imageUrl: string | null = null

  if (spotifyId) {
    try {
      imageUrl = await fetchSpotifyArtistImage(spotifyId)
    } catch {
      // continue to Discogs fallback
    }
  }

  if (!imageUrl && discogsId) {
    try {
      imageUrl = await fetchDiscogsArtistImage(discogsId)
    } catch {
      // no image available
    }
  }

  if (!imageUrl) {
    return NextResponse.json({ error: 'No image found for this artist' }, { status: 404 })
  }

  return NextResponse.json({ imageUrl })
}
