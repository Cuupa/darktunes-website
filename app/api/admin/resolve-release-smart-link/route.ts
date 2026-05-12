/**
 * app/api/admin/resolve-release-smart-link/route.ts
 *
 * POST /api/admin/resolve-release-smart-link
 * Body: { releaseId: string }
 * Auth: Bearer <supabase-access-token>  (admin or editor role required)
 *
 * Resolves an Odesli (song.link) smart URL for the given release and persists
 * it to releases.smart_url so it can be displayed on the public release detail
 * page.
 *
 * The Odesli API is free for up to ~10 req/s with no API key required.
 * See: https://odesli.co/
 *
 * Returns:
 *   { smartUrl: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { HttpError, withExponentialBackoff } from '@/lib/rateLimiter'
import { resolveOdesliSmartLink } from '@/lib/sync/odesliApi'

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

type ProfileRole = 'admin' | 'editor' | 'user' | 'journalist'

async function verifyTokenAndRole(token: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase service key not configured')

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
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

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Authenticate
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

  // 2. Parse body
  let releaseId: string | undefined
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null && 'releaseId' in body) {
      releaseId = String((body as { releaseId: unknown }).releaseId).trim()
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!releaseId) {
    return NextResponse.json({ error: 'Missing required field: releaseId' }, { status: 400 })
  }

  // 3. Load the release to get its Spotify URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const db = createClient<Database>(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: releaseRow, error: releaseErr } = await db
    .from('releases')
    .select('id, spotify_url, apple_music_url, smart_url')
    .eq('id', releaseId)
    .single()

  if (releaseErr || !releaseRow) {
    return NextResponse.json({ error: 'Release not found' }, { status: 404 })
  }

  // Prefer Spotify URL; fall back to Apple Music
  const musicUrl = releaseRow.spotify_url ?? releaseRow.apple_music_url
  if (!musicUrl) {
    return NextResponse.json(
      { error: 'Release has no Spotify or Apple Music URL to resolve' },
      { status: 422 },
    )
  }

  // 4. Resolve smart link via Odesli
  try {
    const result = await withExponentialBackoff(() =>
      resolveOdesliSmartLink(musicUrl, globalThis.fetch),
    )

    // 5. Persist smart_url back to the release
    const { error: updateErr } = await db
      .from('releases')
      .update({ smart_url: result.smartUrl })
      .eq('id', releaseId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ smartUrl: result.smartUrl })
  } catch (err) {
    if (err instanceof HttpError) {
      const status = err.status >= 500 ? 502 : err.status
      return NextResponse.json({ error: err.message }, { status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to resolve smart link' },
      { status: 500 },
    )
  }
}
