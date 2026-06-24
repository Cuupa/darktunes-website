/**
 * app/api/contact/route.ts — Contact form submission handler
 *
 * POST /api/contact
 *
 * Validates the form payload, checks the honeypot, optionally sends an email
 * via Resend (when configured in Admin → API Keys), and returns a success response.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { checkRateLimit, getClientIp } from '@/lib/ipRateLimit'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getEmailCredentials } from '@/lib/secrets/getExternalCredentials'

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  // Accept any non-empty string so custom admin-configured topics work.
  // The honeypot check below handles spam; topic is informational only.
  topic: z.string().min(1, 'Topic is required').max(100),
  message: z.string().min(20, 'Message must be at least 20 characters'),
  gdprConsent: z.literal(true, { error: 'GDPR consent is required' }),
  website: z.string().max(0, 'Honeypot triggered').optional(),
})

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  // 5 requests per 10 minutes per IP
  if (checkRateLimit(getClientIp(request), 5, 10 * 60_000).limited) {
    throw new ApiError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED')
  }

  const body: unknown = await request.json()
  const parsed = contactSchema.safeParse(body)

  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ')
    throw new ApiError(400, message, 'VALIDATION_ERROR')
  }

  const { name, email, topic, message, website } = parsed.data

  // Honeypot check — if filled, silently succeed (spam bot)
  if (website && website.length > 0) {
    return NextResponse.json({ success: true })
  }

  const recipientEmail = process.env.CONTACT_EMAIL ?? 'info@darktunes.com'
  const db = await createServiceRoleSupabaseClient()
  const { resendApiKey, resendFromEmail } = await getEmailCredentials(db)

  if (resendApiKey) {
    const fromEmail = resendFromEmail ?? 'noreply@darktunes.com'
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipientEmail,
        reply_to: email,
        subject: `[darkTunes Contact] ${topic.toUpperCase()} — ${name}`,
        text: [
          `From: ${name} <${email}>`,
          `Topic: ${topic}`,
          '',
          message,
        ].join('\n'),
      }),
    })

    if (!resendRes.ok) {
      console.error('[contact] Resend error:', await resendRes.text())
      throw new ApiError(502, 'Failed to send email')
    }
  } else {
    // Log that a submission was received without exposing personal data
    console.log('[contact] New submission received (email service not configured)')
  }

  return NextResponse.json({ success: true })
})
