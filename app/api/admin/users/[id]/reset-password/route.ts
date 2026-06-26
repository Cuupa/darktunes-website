/**
 * app/api/admin/users/[id]/reset-password/route.ts
 *
 * POST /api/admin/users/:id/reset-password
 *
 * Sends a password recovery email to the target user.
 * Uses branded Resend mail when configured; falls back to Supabase otherwise.
 *
 * Security: only users with role = 'admin' may call this endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requestPasswordReset } from '@/lib/auth/requestPasswordReset'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { ApiError, buildApiError, withErrorHandler } from '@/lib/errors'
import { getEmailCredentials } from '@/lib/secrets/getExternalCredentials'

function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  // /api/admin/users/:id/reset-password → id is second-to-last segment
  return segments[segments.length - 2] ?? ''
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const callerRole = await getUserRoleWithClient(supabase, user.id)
  if (callerRole !== 'admin') throw new ApiError(403, 'Forbidden')

  const userId = extractId(req)
  if (!userId) throw new ApiError(400, 'Missing user ID')

  const { data: target, error: targetError } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle()

  if (targetError) throw buildApiError('DB_ERROR', 500)
  if (!target?.email) throw new ApiError(404, 'User not found')

  const serviceDb = await createServiceRoleSupabaseClient()
  const { resendApiKey, resendFromEmail } = await getEmailCredentials(serviceDb)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com'

  const result = await requestPasswordReset(serviceDb, target.email, {
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