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
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { extractYouTubeVideoId } from '@/lib/parsers/platformUrlParser'

interface OEmbedResponse {
  title: string
  author_name: string
  thumbnail_url: string
  html: string
}

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyAdminOrEditor(token)

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
