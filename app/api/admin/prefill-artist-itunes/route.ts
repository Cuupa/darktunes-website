import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { HttpError, withExponentialBackoff } from '@/lib/rateLimiter'

type ProfileRole = 'admin' | 'editor' | 'user' | 'journalist' | 'artist'

interface ItunesLookupResult {
  wrapperType?: string
  artistName?: string
  artistId?: number
  primaryGenreName?: string
  artworkUrl100?: string
  artistLinkUrl?: string
}

interface ItunesLookupResponse {
  resultCount: number
  results: ItunesLookupResult[]
}

interface PrefillItunesResponse {
  name: string
  genres: string[]
  imageUrl: string | null
  appleMusicUrl: string
  itunesArtistId: string
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

function extractItunesArtistId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return trimmed

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const hostname = parsed.hostname.toLowerCase()
    if (hostname !== 'music.apple.com' && hostname !== 'www.music.apple.com') return null

    const parts = parsed.pathname.split('/').filter(Boolean)
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (/^\d+$/.test(parts[i])) return parts[i]
    }
  } catch {
    return null
  }

  return null
}

function getArtistImageUrl(artworkUrl100: string | undefined): string | null {
  if (!artworkUrl100) return null
  return artworkUrl100.replace(/\d+x\d+bb(\.\w+)$/, '600x600bb$1')
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

  let appleMusicUrl: string | undefined
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null && 'appleMusicUrl' in body) {
      appleMusicUrl = String((body as { appleMusicUrl: unknown }).appleMusicUrl)
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!appleMusicUrl) {
    return NextResponse.json({ error: 'Missing required field: appleMusicUrl' }, { status: 400 })
  }

  const artistId = extractItunesArtistId(appleMusicUrl)
  if (!artistId) {
    return NextResponse.json({ error: 'Invalid Apple Music artist URL or ID' }, { status: 400 })
  }

  try {
    const lookup = await withExponentialBackoff(async () => {
      const response = await globalThis.fetch(
        `https://itunes.apple.com/lookup?id=${encodeURIComponent(artistId)}`,
      )
      if (!response.ok) {
        throw new HttpError(response.status, `iTunes API error: ${response.status}`)
      }
      return (await response.json()) as ItunesLookupResponse
    })

    const artist = lookup.results[0]
    if (!artist) {
      return NextResponse.json({ error: 'Artist not found on Apple Music' }, { status: 400 })
    }
    if (artist.wrapperType !== 'artist') {
      return NextResponse.json({ error: 'Apple Music lookup did not return an artist entity' }, { status: 400 })
    }
    if (!artist.artistName || !artist.artistId) {
      return NextResponse.json({ error: 'Apple Music artist data is incomplete' }, { status: 400 })
    }

    const response: PrefillItunesResponse = {
      name: artist.artistName,
      genres: artist.primaryGenreName ? [artist.primaryGenreName] : [],
      imageUrl: getArtistImageUrl(artist.artworkUrl100),
      appleMusicUrl: artist.artistLinkUrl ?? `https://music.apple.com/artist/${artist.artistId}`,
      itunesArtistId: String(artist.artistId),
    }

    return NextResponse.json(response)
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to prefill artist from Apple Music' },
      { status: 502 },
    )
  }
}
