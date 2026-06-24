/**
 * app/api/admin/send-external-email/route.ts
 *
 * POST /api/admin/send-external-email
 *
 * Sends an email to an arbitrary external recipient via the Resend API.
 * Requires the caller to be an authenticated admin.
 *
 * Request body:
 *   { to: string, subject: string, html: string, text?: string, replyTo?: string }
 *
 * Transport: Resend credentials from Admin → API Keys (encrypted in api_credentials).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getEmailCredentials } from '@/lib/secrets/getExternalCredentials'
import { ApiError, withErrorHandler } from '@/lib/errors'

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new ApiError(401, 'Unauthorized')
  const role = await getUserRoleWithClient(supabase, user.id)
  if (role !== 'admin') throw new ApiError(403, 'Admin only')

  const body = await req.json() as unknown
  if (!body || typeof body !== 'object') throw new ApiError(400, 'Invalid request body')
  const { to, subject, html, text, replyTo } = body as Record<string, unknown>

  if (typeof to !== 'string' || !to.trim()) throw new ApiError(400, 'Missing "to" field')
  if (typeof subject !== 'string' || !subject.trim()) throw new ApiError(400, 'Missing "subject" field')
  if (typeof html !== 'string' || !html.trim()) throw new ApiError(400, 'Missing "html" field')

  const serviceDb = await createServiceRoleSupabaseClient()
  const { resendApiKey: apiKey, resendFromEmail } = await getEmailCredentials(serviceDb)
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Email not configured',
        hint: 'Configure Resend credentials in Admin → API Keys.',
      },
      { status: 501 },
    )
  }

  const from = resendFromEmail ?? 'noreply@darktunes.com'

  const payload: Record<string, unknown> = {
    from,
    to: [to.trim()],
    subject: subject.trim(),
    html,
  }
  if (typeof text === 'string' && text.trim()) payload['text'] = text.trim()
  if (typeof replyTo === 'string' && replyTo.trim()) payload['reply_to'] = replyTo.trim()

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new ApiError(502, `Resend API error: ${errText}`)
  }

  return NextResponse.json({ ok: true })
})
