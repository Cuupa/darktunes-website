/**
 * app/api/contact/route.ts — Contact form submission handler
 *
 * POST /api/contact
 *
 * Validates the form payload, checks the honeypot, optionally sends an email
 * via Resend (when RESEND_API_KEY is set), and returns a success response.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'

const SUBMITHUB_ALLOW = ['label', 'shop', 'booking', 'other'] as const

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  topic: z.enum(SUBMITHUB_ALLOW),
  message: z.string().min(20, 'Message must be at least 20 characters'),
  gdprConsent: z.literal(true, {
    errorMap: () => ({ message: 'GDPR consent is required' }),
  }),
  website: z.string().max(0, 'Honeypot triggered').optional(),
})

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
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
  const resendApiKey = process.env.RESEND_API_KEY

  if (resendApiKey) {
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@darktunes.com'
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
    // Log contact submission when email service is not configured
    console.log('[contact] New submission (email not configured):', {
      name,
      email,
      topic,
      message: message.slice(0, 80),
    })
  }

  return NextResponse.json({ success: true })
})
