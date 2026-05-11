/**
 * app/api/sync-artist/route.ts — Manual artist sync trigger
 *
 * POST /api/sync-artist
 * Body: { artistId: string }
 * Auth: Bearer <supabase-access-token>
 *
 * Verifies the caller is authenticated, then runs the full sync pipeline
 * for the given artist: fetches iTunes releases, caches cover art in R2,
 * upserts releases to Supabase, and writes a sync_log entry.
 *
 * All business logic lives in src/lib/sync/syncArtist.ts — this handler
 * only wires up real dependencies.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import type { Database } from '@/types/database'
import { syncArtist } from '@/lib/sync/syncArtist'
import { createR2Client, uploadUrlToR2 } from '@/lib/r2Utils'

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function verifyToken(token: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase service key not configured')

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new Error('Unauthorized')
  return data.user.id
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
  let artistId: string | undefined
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null && 'artistId' in body) {
      artistId = String((body as { artistId: unknown }).artistId)
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!artistId) {
    return NextResponse.json({ error: 'Missing required field: artistId' }, { status: 400 })
  }

  // 3. Validate R2 configuration
  const {
    CLOUDFLARE_R2_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    CLOUDFLARE_R2_BUCKET_NAME,
    CLOUDFLARE_R2_PUBLIC_URL,
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env

  if (
    !CLOUDFLARE_R2_ACCOUNT_ID ||
    !CLOUDFLARE_R2_ACCESS_KEY_ID ||
    !CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
    !CLOUDFLARE_R2_BUCKET_NAME ||
    !CLOUDFLARE_R2_PUBLIC_URL
  ) {
    return NextResponse.json({ error: 'R2 storage is not configured' }, { status: 500 })
  }

  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  // 4. Wire up dependencies
  const db = createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const s3 = createR2Client(
    CLOUDFLARE_R2_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const uploadFn = (imageUrl: string, keyPrefix: string) =>
    uploadUrlToR2(imageUrl, s3, CLOUDFLARE_R2_BUCKET_NAME, CLOUDFLARE_R2_PUBLIC_URL, keyPrefix)

  // 5. Run sync (never throws — errors are in SyncResult.errors)
  try {
    const result = await syncArtist(artistId, {
      db,
      fetch: globalThis.fetch,
      uploadToR2: uploadFn,
    })
    revalidateTag('releases')
    revalidateTag('artists')
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 },
    )
  }
}
