/**
 * app/api/newsletter/unsubscribe/route.ts
 *
 * GDPR-compliant one-click unsubscribe endpoint.
 *
 * Called when a subscriber clicks the unsubscribe link in a newsletter email:
 *   GET /api/newsletter/unsubscribe?token=<uuid>
 *
 * The token is the permanent `unsubscribe_token` stored on the subscriber row
 * (distinct from the single-use `verification_token` used during sign-up).
 *
 * On success: sets status to 'unsubscribed' and redirects to
 *   /newsletter/confirmed?unsubscribed=1
 * On failure: redirects to /newsletter/confirmed?error=1
 *
 * Security:
 *  - Tokens are 128-bit UUIDs generated at insert time (never cleared).
 *  - The UPDATE is executed with the service-role key, bypassing RLS.
 *  - No sensitive data is returned — only a redirect.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { unsubscribeByToken } from '@/lib/api/newsletter'
import { withErrorHandler, ApiError } from '@/lib/errors'

const successUrl = '/newsletter/confirmed?unsubscribed=1'
const errorUrl = '/newsletter/confirmed?error=1'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    throw new ApiError(400, 'Missing unsubscribe token', 'MISSING_TOKEN')
  }

  // Basic UUID format check — prevents malformed tokens from hitting the DB
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidPattern.test(token)) {
    return NextResponse.redirect(new URL(errorUrl, req.url))
  }

  const db = getServiceClient()
  if (!db) {
    console.warn('[newsletter/unsubscribe] Supabase not configured.')
    return NextResponse.redirect(new URL(successUrl, req.url))
  }

  try {
    const subscriber = await unsubscribeByToken(db, token)
    if (!subscriber) {
      return NextResponse.redirect(new URL(errorUrl, req.url))
    }
    console.log(`[newsletter/unsubscribe] ${subscriber.email} unsubscribed.`)
  } catch (err) {
    console.error('[newsletter/unsubscribe] DB error:', err instanceof Error ? err.message : err)
    return NextResponse.redirect(new URL(errorUrl, req.url))
  }

  return NextResponse.redirect(new URL(successUrl, req.url))
})
