/**
 * app/api/admin/cleanup-orphaned-releases/route.ts
 *
 * POST /api/admin/cleanup-orphaned-releases
 * Auth: Bearer <supabase-access-token> (admin or editor role required)
 *
 * Deletes all releases whose artist_id is NULL (orphaned — no linked artist).
 * Returns { deleted: number }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withErrorHandler, ApiError } from '@/lib/errors'
import type { Database } from '@/types/database'

type ProfileRole = 'admin' | 'editor' | 'user' | 'journalist' | 'artist'

async function verifyTokenAndRole(token: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new ApiError(500, 'Supabase service key not configured')

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new ApiError(401, 'Unauthorized')

  const { data: profile, error: profileErr } = await admin
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileErr) throw new ApiError(500, profileErr.message)
  const role = profile?.role as ProfileRole | undefined
  if (!role || (role !== 'admin' && role !== 'editor')) {
    throw new ApiError(403, 'Forbidden')
  }
}

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const authHeader = request.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid Authorization header')
  }
  await verifyTokenAndRole(authHeader.slice(7))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new ApiError(500, 'Supabase is not configured')
  }

  // Use service-role client to bypass RLS (delete requires admin role via RLS,
  // but service role ensures this works regardless of the caller's Supabase JWT)
  const db = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const { data, error } = await db
    .from('releases')
    .delete()
    .is('artist_id', null)
    .select('id')

  if (error) throw new ApiError(500, `Cleanup failed: ${error.message}`)

  return NextResponse.json({ deleted: (data ?? []).length })
})
