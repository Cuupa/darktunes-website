/**
 * app/api/newsletter/route.ts
 *
 * Legacy REST endpoint for newsletter subscriptions (Double Opt-In).
 *
 * This route is kept as a server-to-server fallback (e.g. for testing via
 * curl or for third-party integrations). The primary subscription path is the
 * `subscribeToNewsletter` Server Action in `app/actions/newsletter.ts`.
 *
 * Flow:
 *  1. Validates input (email required, name optional) using Zod.
 *  2. Generates a UUID verification_token.
 *  3. Inserts the subscriber into `newsletter_subscribers` with status='pending'
 *     using the service-role key (bypasses RLS).
 *  4. A Supabase Edge Function (newsletter-confirm) is triggered by the DB
 *     INSERT webhook and sends the DOI confirmation email asynchronously.
 *
 * Anti-enumeration: duplicate emails are silently treated as success.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createPendingSubscriber } from '@/lib/api/newsletter'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().max(120).optional(),
})

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation error' },
      { status: 422 },
    )
  }

  const { email, name } = parsed.data
  const verificationToken = randomUUID()

  const db = getServiceClient()
  if (db) {
    try {
      await createPendingSubscriber(db, email, verificationToken, name)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('23505') || message.toLowerCase().includes('duplicate')) {
        // Anti-enumeration: silent success for already-registered emails
        return NextResponse.json({ success: true })
      }
      console.error('[newsletter] createPendingSubscriber error:', message)
      return NextResponse.json(
        { error: 'Subscription failed. Please try again.' },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ success: true })
}
