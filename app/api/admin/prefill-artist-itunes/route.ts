import { NextRequest, NextResponse } from 'next/server'
import { HttpError, withExponentialBackoff } from '@/lib/rateLimiter'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'

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

function extractItunesArtistId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return trimmed

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const hostname = parsed.hostname.toLowerCase()
    if (hostname !== 'music.apple.com' && !hostname.endsWith('.music.apple.com')) return null

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

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  // 1. Authenticate — admin or editor role required
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  let appleMusicUrl: string | undefined
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null && 'appleMusicUrl' in body) {
      appleMusicUrl = String((body as { appleMusicUrl: unknown }).appleMusicUrl)
    }
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  if (!appleMusicUrl) {
    throw new ApiError(400, 'Missing required field: appleMusicUrl')
  }

  const artistId = extractItunesArtistId(appleMusicUrl)
  if (!artistId) {
    throw new ApiError(400, 'Invalid Apple Music artist URL or ID')
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
      throw new ApiError(400, 'Artist not found on Apple Music')
    }
    if (artist.wrapperType !== 'artist') {
      throw new ApiError(400, 'The provided Apple Music link is not an artist profile')
    }
    if (!artist.artistName || !artist.artistId) {
      throw new ApiError(400, 'Apple Music artist data is incomplete')
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
    if (err instanceof ApiError) throw err
    if (err instanceof HttpError) {
      throw new ApiError(502, err.message)
    }
    throw err
  }
})
