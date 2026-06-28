/**
 * app/api/admin/users/invite/route.ts
 *
 * POST /api/admin/users/invite
 *
 * Sends a branded invite email (Resend when configured) so a new user can set a
 * password and sign in. Requires a staff role (admin, artist, editor, or journalist).
 *
 * Security: only users with role = 'admin' may call this endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requestUserInvite } from '@/lib/auth/requestUserInvite'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { ApiError, buildApiError, withErrorHandler } from '@/lib/errors'
import { getEmailCredentials } from '@/lib/secrets/getExternalCredentials'
import { INVITABLE_ROLES, type InvitableRole } from '@/types/users'

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const callerRole = await getUserRoleWithClient(supabase, user.id)

  if (callerRole !== 'admin') throw new ApiError(403, 'Forbidden')

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!email) throw new ApiError(400, 'email is required')

  const roleRaw = typeof body.role === 'string' ? body.role.trim() : ''
  if (!roleRaw) throw new ApiError(400, 'role is required')
  if (!INVITABLE_ROLES.includes(roleRaw as InvitableRole)) {
    throw new ApiError(400, 'Invalid role — must be admin, artist, editor, or journalist')
  }
  const role = roleRaw as InvitableRole

  const adminClient = await createServiceRoleSupabaseClient()
  const { resendApiKey, resendFromEmail } = await getEmailCredentials(adminClient)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com'

  const result = await requestUserInvite(
    adminClient,
    {
      email,
      role,
      grantedBy: user.id,
    },
    {
      resendApiKey,
      resendFromEmail: resendFromEmail ?? 'noreply@darktunes.com',
      siteUrl,
      fetch,
    },
  )

  if (result.alreadyRegistered) {
    throw new ApiError(409, `A user with email "${email}" already exists.`)
  }

  if (!result.sent) {
    throw buildApiError('EMAIL_SEND_FAILED', 500)
  }

  return NextResponse.json({ ok: true, email, channel: result.channel })
})