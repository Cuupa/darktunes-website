/**
 * app/api/admin/users/route.ts
 *
 * GET /api/admin/users
 * Returns all registered users enriched with their profile role and
 * any linked artist.
 *
 * Security: only users with role = 'admin' may call this endpoint.
 * The Supabase Auth Admin API (listUsers) requires the service-role key.
 */

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { listUsersWithProfiles } from '@/lib/api/users'
import { getUserRoleWithClient } from '@/lib/getUserRole'

export const GET = withErrorHandler(async (): Promise<NextResponse> => {
  // 1. Verify caller is authenticated and is an admin
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const role = await getUserRoleWithClient(supabase, user.id)

  if (role !== 'admin') throw new ApiError(403, 'Forbidden')

  // 2. Fetch user list via service-role client (Admin API)
  const adminClient = await createServiceRoleSupabaseClient()
  const users = await listUsersWithProfiles(adminClient)

  return NextResponse.json({ users })
})
