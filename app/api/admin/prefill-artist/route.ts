import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { HttpError, withExponentialBackoff } from '@/lib/rateLimiter'
import { fetchSpotifyArtistProfile } from '@/lib/sync/spotifyApi'

type ProfileRole = 'admin' | 'editor' | 'user' | 'journalist'

interface PrefillResponse {
  spotifyId: string
  name: string
  imageUrl: string | null
  genres: string[]
  spotifyUrl: string
}

async function verifyTokenAndRole(token: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase service key not configured')

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new Error('Unauthorized')

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileErr) throw new Error(profileErr.message)
  const role = profile?.role as ProfileRole | undefined
  if (!role || (role !== 'admin' && role !== 'editor')) {
    throw new Error('Forbidden')
  }
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
  }

  try {
    await verifyTokenAndRole(authHeader.slice(7))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized'
    const status = message === 'Forbidden' ? 403 : 401
    return NextResponse.json({ error: message }, { status })
  }

  let spotifyUrl: string | undefined
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null && 'spotifyUrl' in body) {
      spotifyUrl = String((body as { spotifyUrl: unknown }).spotifyUrl)
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!spotifyUrl) {
    return NextResponse.json({ error: 'Missing required field: spotifyUrl' }, { status: 400 })
  }

  const spotifyArtistId = extractSpotifyArtistId(spotifyUrl)
  if (!spotifyArtistId) {
    return NextResponse.json({ error: 'Invalid Spotify artist URL or ID' }, { status: 400 })
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Spotify is not configured' }, { status: 503 })
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
    if (err instanceof HttpError) {
      const status = err.status >= 500 ? 502 : err.status
      return NextResponse.json({ error: err.message }, { status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to prefill artist' },
      { status: 500 },
    )
  }
}
