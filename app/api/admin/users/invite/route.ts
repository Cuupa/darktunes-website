/**
 * app/api/admin/users/invite/route.ts
 *
 * POST /api/admin/users/invite
 * Security: admin only (Bearer or cookie dual auth).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requestUserInvite } from '@/lib/auth/requestUserInvite'
import { requireAdminWithServiceClient } from '@/lib/adminAuth'
import { ApiError, buildApiError, withErrorHandler } from '@/lib/errors'
import { getEmailCredentials } from '@/lib/secrets/getExternalCredentials'
import { INVITABLE_ROLES, type InvitableRole } from '@/types/users'

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { userId, serviceClient: adminClient } = await requireAdminWithServiceClient(req)

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

  const { resendApiKey, resendFromEmail } = await getEmailCredentials(adminClient)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com'

  const result = await requestUserInvite(
    adminClient,
    {
      email,
      role,
      grantedBy: userId,
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
