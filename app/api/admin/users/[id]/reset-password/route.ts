/**
 * app/api/admin/users/[id]/reset-password/route.ts
 *
 * POST /api/admin/users/:id/reset-password
 * Security: admin only (Bearer or cookie dual auth).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requestPasswordReset } from '@/lib/auth/requestPasswordReset'
import { requireAdminWithServiceClient } from '@/lib/adminAuth'
import { ApiError, buildApiError, withErrorHandler } from '@/lib/errors'
import { getEmailCredentials } from '@/lib/secrets/getExternalCredentials'

function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  return segments[segments.length - 2] ?? ''
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { serviceClient } = await requireAdminWithServiceClient(req)

  const userId = extractId(req)
  if (!userId) throw new ApiError(400, 'Missing user ID')

  const { data: target, error: targetError } = await serviceClient
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle()

  if (targetError) throw buildApiError('DB_ERROR', 500)
  if (!target?.email) throw new ApiError(404, 'User not found')

  const { resendApiKey, resendFromEmail } = await getEmailCredentials(serviceClient)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com'

  const result = await requestPasswordReset(serviceClient, target.email, {
    resendApiKey,
    resendFromEmail: resendFromEmail ?? 'noreply@darktunes.com',
    siteUrl,
    fetch,
  })

  if (!result.sent) {
    if (result.silent) {
      throw new ApiError(404, 'User not found or recovery email could not be sent')
    }
    throw buildApiError('EMAIL_SEND_FAILED', 500)
  }

  return NextResponse.json({ ok: true, email: target.email, channel: result.channel })
})
