/**
 * app/api/admin/artists/route.ts
 *
 * GET /api/admin/artists
 * Returns all artists (id, name, slug) for admin UI dropdowns.
 *
 * Security: only users with role = 'admin' may call this endpoint.
 */

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { getArtists } from '@/lib/api/artists'

export const GET = withErrorHandler(async (): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') throw new ApiError(403, 'Forbidden')

  const artists = await getArtists(supabase)
  return NextResponse.json({ artists })
})
