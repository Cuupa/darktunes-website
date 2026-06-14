/**
 * app/api/admin/users/invite/route.ts
 *
 * POST /api/admin/users/invite
 *
 * Sends a Supabase invite email to the given address so a new user can set a
 * password and sign in.  Optionally assigns a role (defaults to 'user').
 *
 * Security: only users with role = 'admin' may call this endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { ApiError, buildApiError, withErrorHandler } from '@/lib/errors'

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  // 1. Verify caller is authenticated and is an admin
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') throw new ApiError(403, 'Forbidden')

  // 2. Parse request body
  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!email) throw new ApiError(400, 'email is required')

  const role = typeof body.role === 'string' ? body.role : 'user'

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com').replace(/\/$/, '')

  // 3. Send invite via service-role client (Admin API)
  const adminClient = await createServiceRoleSupabaseClient()
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/login`,
    data: { role },
  })

  if (inviteError) {
    // 422 from Supabase means the user already exists
    if (inviteError.message.toLowerCase().includes('already registered')) {
      throw new ApiError(409, `A user with email "${email}" already exists.`)
    }
    throw buildApiError('EMAIL_SEND_FAILED', 500)
  }

  return NextResponse.json({ ok: true, email })
})
