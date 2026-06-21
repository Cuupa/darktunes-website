/**
 * app/api/portal/proxy-image/route.ts
 *
 * Server-side image proxy for the Artist Portal EPK PDF generator.
 *
 * @react-pdf/renderer fetches images client-side via the browser Fetch API.
 * External image hosts (Cloudflare R2, Supabase Storage, Vercel Blob, etc.)
 * may not return `Access-Control-Allow-Origin` headers, so the browser blocks
 * those cross-origin fetches. This route fetches the image server-side (no
 * CORS restriction applies) and pipes it back to the client.
 *
 * Security:
 *   - Only authenticated portal users may call this endpoint (Supabase session).
 *   - The `url` parameter is validated against an allowlist of trusted hostnames
 *     to prevent Server-Side Request Forgery (SSRF). Permitted patterns cover
 *     Cloudflare R2 (`*.r2.dev`), Supabase Storage (`*.supabase.co`), and
 *     Vercel Blob Storage (`*.vercel-storage.com`).
 */

import { type NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/** Hostnames that are allowed to be proxied. Covers Cloudflare R2, Supabase Storage, and Vercel Blob Storage. */
const ALLOWED_HOSTNAME_PATTERNS: RegExp[] = [
  /^[^.]+\.r2\.dev$/,
  /^[^.]+\.supabase\.co$/,
  /^[^.]+\.public\.blob\.vercel-storage\.com$/,
  /^[^.]+\.blob\.vercel-storage\.com$/,
]

export const GET = withErrorHandler(async (request: NextRequest) => {
  // 1. Authenticate — require a valid Supabase session cookie.
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new ApiError(401, 'Unauthorized')

  // 2. Validate the `url` query parameter.
  const { searchParams } = request.nextUrl
  const url = searchParams.get('url')
  if (!url) throw new ApiError(400, 'Missing url parameter')

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new ApiError(400, 'Invalid url parameter')
  }

  // 3. SSRF allowlist — only permit known trusted hostnames.
  if (!ALLOWED_HOSTNAME_PATTERNS.some((re) => re.test(parsed.hostname))) {
    throw new ApiError(403, 'Forbidden hostname')
  }

  // 4. Fetch the image server-side and stream it back.
  const upstream = await fetch(url)
  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status })
  }

  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  })
})
