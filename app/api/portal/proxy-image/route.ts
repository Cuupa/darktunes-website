/**
 * app/api/portal/proxy-image/route.ts
 *
 * Server-side image proxy for the Artist Portal EPK PDF generator.
 *
 * Legacy server-side image proxy for authenticated portal users.
 * EPK PDF export now uses browser print (WYSIWYG) and does not call this route.
 * Kept for potential client-side fetches that need CORS bypass.
 *
 * Security:
 *   - Only authenticated portal users may call this endpoint (session cookie or Bearer token).
 *   - The `url` parameter is validated against an SSRF-safe hostname allowlist.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import {
  createBearerAuthSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase/server'
import { isAllowedEpkImageUrl } from '@/lib/epk/epkImageProxy'

async function authenticatePortalUser(request: NextRequest) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (bearer) {
    const supabase = await createBearerAuthSupabaseClient(bearer)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) throw new ApiError(401, 'Unauthorized')
    return user
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new ApiError(401, 'Unauthorized')
  return user
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  // 1. Authenticate — session cookie or Bearer token.
  await authenticatePortalUser(request)

  // 2. Validate the `url` query parameter.
  const { searchParams } = request.nextUrl
  const url = searchParams.get('url')
  if (!url) throw new ApiError(400, 'Missing url parameter')

  // 3. SSRF allowlist — only permit known trusted hostnames.
  const { serverEnv } = await import('@/lib/env.server')

  if (!isAllowedEpkImageUrl(url, serverEnv.CLOUDFLARE_R2_PUBLIC_URL)) {
    throw new ApiError(403, 'Forbidden hostname')
  }

  // 4. Fetch the image server-side and stream it back.
  const upstream = await fetch(url, {
    headers: { Accept: 'image/*,*/*;q=0.8' },
    signal: AbortSignal.timeout(15_000),
  })

  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status })
  }

  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'
  if (!contentType.startsWith('image/')) {
    throw new ApiError(415, 'Upstream response is not an image')
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
})