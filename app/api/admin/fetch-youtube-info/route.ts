/**
 * app/api/admin/fetch-youtube-info/route.ts
 *
 * POST /api/admin/fetch-youtube-info
 * Body: { youtubeUrl: string }  — full YouTube URL or video ID
 * Auth: Bearer <supabase-access-token> (admin or editor role required)
 *
 * Resolves a YouTube video URL or ID and returns structured metadata
 * (title, thumbnail, published date, channel) via the YouTube oEmbed API.
 * No YouTube API key required — oEmbed is a public endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withErrorHandler, ApiError } from '@/lib/errors'

type ProfileRole = 'admin' | 'editor' | 'user' | 'journalist' | 'artist'

async function verifyTokenAndRole(token: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new ApiError(500, 'Supabase service key not configured')

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new ApiError(401, 'Unauthorized')

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileErr) throw new ApiError(500, profileErr.message)
  const role = profile?.role as ProfileRole | undefined
  if (!role || (role !== 'admin' && role !== 'editor')) {
    throw new ApiError(403, 'Forbidden')
  }
}

/**
 * Extracts a YouTube video ID from a URL or returns the raw input if it
 * already looks like a standalone ID (11 alphanumeric + dash + underscore chars).
 */
function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Already a plain video ID (11 chars, alphanumeric + - + _)
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)

    // https://www.youtube.com/watch?v=ID
    if (
      (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') &&
      parsed.pathname === '/watch'
    ) {
      const v = parsed.searchParams.get('v')
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v
    }

    // https://youtu.be/ID
    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0]
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return id
    }

    // https://www.youtube.com/embed/ID  or  /v/ID  or  /shorts/ID
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    if (['embed', 'v', 'shorts'].includes(pathParts[0]) && pathParts[1]) {
      const id = pathParts[1].split('?')[0]
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id
    }
  } catch {
    return null
  }

  return null
}

interface OEmbedResponse {
  title: string
  author_name: string
  thumbnail_url: string
  html: string
}

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const authHeader = request.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid Authorization header')
  }
  await verifyTokenAndRole(authHeader.slice(7))

  let youtubeUrl: string | undefined
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null && 'youtubeUrl' in body) {
      youtubeUrl = String((body as { youtubeUrl: unknown }).youtubeUrl)
    }
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  if (!youtubeUrl) throw new ApiError(400, 'Missing required field: youtubeUrl')

  const videoId = extractYouTubeVideoId(youtubeUrl)
  if (!videoId) throw new ApiError(400, 'Could not extract a valid YouTube video ID from the provided URL')

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`
  const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`

  const res = await fetch(oEmbedUrl)
  if (!res.ok) {
    if (res.status === 404) throw new ApiError(404, 'Video not found or not embeddable')
    throw new ApiError(502, `YouTube oEmbed error: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as OEmbedResponse

  return NextResponse.json({
    videoId,
    title: data.title ?? '',
    channelTitle: data.author_name ?? '',
    thumbnailUrl: data.thumbnail_url ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    canonicalUrl,
  })
})
