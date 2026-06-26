/**
 * POST /api/auth/forgot-password
 *
 * Sends a password recovery email. Uses branded Resend mail when configured;
 * falls back to Supabase's built-in recovery email otherwise.
 *
 * Always returns { ok: true } on valid input to prevent email enumeration.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requestPasswordReset } from '@/lib/auth/requestPasswordReset'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { checkRateLimit, getClientIp } from '@/lib/ipRateLimit'
import { getEmailCredentials } from '@/lib/secrets/getExternalCredentials'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  if (checkRateLimit(getClientIp(request), 3, 10 * 60_000).limited) {
    throw new ApiError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED')
  }

  const body: unknown = await request.json()
  const parsed = forgotPasswordSchema.safeParse(body)

  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ')
    throw new ApiError(400, message, 'VALIDATION_ERROR')
  }

  const db = await createServiceRoleSupabaseClient()
  const { resendApiKey, resendFromEmail } = await getEmailCredentials(db)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com'

  const result = await requestPasswordReset(db, parsed.data.email, {
    resendApiKey,
    resendFromEmail: resendFromEmail ?? 'noreply@darktunes.com',
    siteUrl,
    fetch,
  })

  if (!result.sent && result.error) {
    console.error('[forgot-password] Password reset email failed:', result.error)
  }

  return NextResponse.json({ ok: true })
})