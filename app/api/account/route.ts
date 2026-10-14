/**
 * app/api/account/route.ts
 *
 * DELETE /api/account
 * Authenticated users can request soft-deletion of their own account.
 *
 * Behaviour:
 *   - Validates the user is not an admin (admins must be deleted manually)
 *   - Anonymises the login email and display name
 *   - Bans the auth user so they cannot sign in
 *   - Keeps invoices, statements, and the auth user row
 *   - Logs the request in app_logs
 */

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { softDeleteAccount } from '@/lib/api/users'
import { writeAppLog } from '@/lib/appLog'

export const DELETE = withErrorHandler(async (): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  // 1. Check current role — admins cannot use self-service deletion
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role, deleted_at')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) throw new ApiError(404, 'Profile not found')
  if (profile.role === 'admin') {
    throw new ApiError(403, 'Admin accounts cannot be deleted via self-service. Contact your system administrator.')
  }
  if (profile.deleted_at) {
    throw new ApiError(409, 'This account is already closed.')
  }

  // 2. Perform soft-delete (requires service-role to update auth user)
  const adminClient = await createServiceRoleSupabaseClient()
  await softDeleteAccount(adminClient, user.id)

  // 3. Log for compliance auditing
  await writeAppLog({
    source: 'gdpr-deletion',
    level: 'info',
    message: 'User account deletion requested',
    userId: user.id,
    details: { role: profile.role },
  })

  return NextResponse.json({ success: true, message: 'Your login email and display name are anonymised. You will be signed out shortly. Invoices and statements are kept.' })
})
