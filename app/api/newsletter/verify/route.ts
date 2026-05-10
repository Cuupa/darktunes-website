/**
 * app/api/newsletter/verify/route.ts
 *
 * Double Opt-In verification endpoint (step 3 of the DOI flow).
 *
 * Called when the user clicks the confirmation link in their email:
 *   GET /api/newsletter/verify?token=<uuid>
 *
 * Flow:
 *  1. Extracts the `token` query parameter.
 *  2. Looks up the pending subscriber by token in Supabase.
 *  3. Updates the subscriber's status to 'subscribed' (token is cleared).
 *  4. Optionally pushes the verified email to MailerLite via server-to-server.
 *  5. Redirects the browser to /newsletter/confirmed (success page).
 *
 * On failure (invalid / expired token): redirects to /newsletter/confirmed?error=1
 * so the user gets a friendly error message without exposing internals.
 *
 * Security:
 *  - Tokens are single-use UUIDs (128-bit entropy).
 *  - The DB UPDATE only matches rows where status='pending', preventing replay.
 *  - No sensitive data is returned to the browser — only a redirect.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { verifySubscriberToken } from '@/lib/api/newsletter'
import { withErrorHandler, ApiError } from '@/lib/errors'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Pushes a verified subscriber to MailerLite (fire-and-forget).
 * Only runs when MAILERLITE_API_KEY is set. Failure is logged but does NOT
 * prevent the verification from succeeding — the subscriber is already in
 * Supabase.
 */
async function syncToMailerLite(email: string, name?: string): Promise<void> {
  const apiKey = process.env.MAILERLITE_API_KEY
  const groupId = process.env.MAILERLITE_GROUP_ID
  if (!apiKey) return

  const body: Record<string, unknown> = { email, status: 'active' }
  if (name) body.name = name
  if (groupId) body.groups = [groupId]

  try {
    const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok && res.status !== 409) {
      const text = await res.text()
      console.error(`[newsletter/verify] MailerLite error ${res.status}: ${text}`)
    }
  } catch (err) {
    console.error('[newsletter/verify] MailerLite sync failed:', err instanceof Error ? err.message : err)
  }
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

const successUrl = '/newsletter/confirmed'
const errorUrl = '/newsletter/confirmed?error=1'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    throw new ApiError(400, 'Missing verification token', 'MISSING_TOKEN')
  }

  // Basic UUID format check — prevents malformed tokens from hitting the DB
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidPattern.test(token)) {
    return NextResponse.redirect(new URL(errorUrl, req.url))
  }

  const db = getServiceClient()
  if (!db) {
    // Supabase not configured (CI / dev without env vars)
    console.warn('[newsletter/verify] Supabase not configured.')
    return NextResponse.redirect(new URL(successUrl, req.url))
  }

  // Verify token and flip status to 'subscribed'
  let subscriber
  try {
    subscriber = await verifySubscriberToken(db, token)
  } catch (err) {
    console.error('[newsletter/verify] DB error:', err instanceof Error ? err.message : err)
    return NextResponse.redirect(new URL(errorUrl, req.url))
  }

  if (!subscriber) {
    // Token not found or already used
    return NextResponse.redirect(new URL(errorUrl, req.url))
  }

  // Push to MailerLite (non-blocking — failure is logged, not surfaced)
  await syncToMailerLite(subscriber.email, subscriber.name)

  return NextResponse.redirect(new URL(successUrl, req.url))
})
