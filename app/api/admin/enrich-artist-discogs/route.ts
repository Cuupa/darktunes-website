/**
 * app/api/admin/enrich-artist-discogs/route.ts
 *
 * POST /api/admin/enrich-artist-discogs
 * Body: { discogsId: string }
 * Auth: Bearer <supabase-access-token>  (admin or editor role required)
 *
 * Fetches artist profile data from the Discogs API and returns it so the
 * admin can apply it to the artist record in the UI.  This endpoint does NOT
 * write to the database — it only returns the enrichment data; the admin UI
 * saves it via the normal artist update flow.
 *
 * Returns:
 *   { name, bio, imageUrl, urls }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { HttpError, withExponentialBackoff } from '@/lib/rateLimiter'
import { fetchDiscogsArtistProfile } from '@/lib/sync/discogsApi'

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

type ProfileRole = 'admin' | 'editor' | 'user' | 'journalist'

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
  let discogsId: string | undefined
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null && 'discogsId' in body) {
      discogsId = String((body as { discogsId: unknown }).discogsId).trim()
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!discogsId) {
    return NextResponse.json({ error: 'Missing required field: discogsId' }, { status: 400 })
  }

  if (!/^\d+$/.test(discogsId)) {
    return NextResponse.json({ error: 'discogsId must be a numeric string' }, { status: 400 })
  }

  // 3. Fetch from Discogs
  const token = process.env.DISCOGS_TOKEN

  try {
    const profile = await withExponentialBackoff(() =>
      fetchDiscogsArtistProfile(discogsId!, token, globalThis.fetch),
    )

    return NextResponse.json({
      name: profile.name,
      bio: profile.bio,
      imageUrl: profile.imageUrl,
      urls: profile.urls,
    })
  } catch (err) {
    if (err instanceof HttpError) {
      const status = err.status >= 500 ? 502 : err.status
      return NextResponse.json({ error: err.message }, { status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch from Discogs' },
      { status: 500 },
    )
  }
}
