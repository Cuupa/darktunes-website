/**
 * app/api/newsletter/route.ts
 *
 * Secure newsletter subscription endpoint.
 *
 * Flow:
 *  1. Validates input (email required, name optional) using Zod.
 *  2. Stores the subscriber in the Supabase `newsletter_subscribers` table
 *     using the service-role key (bypasses RLS — the browser never touches
 *     the table directly).
 *  3. If MAILERLITE_API_KEY + MAILERLITE_GROUP_ID are set, also adds the
 *     subscriber to the configured MailerLite group.
 *  4. Returns a 200 JSON response on success, or 4xx/5xx on failure.
 *
 * Security:
 *  - Rate-limit-friendly: does not reveal whether an email already exists
 *    (duplicate = silent success).
 *  - No secrets are exposed to the browser; MailerLite API key is server-only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().max(120).optional(),
})

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient<Database>(url, key)
}

async function addToMailerLite(email: string, name?: string): Promise<void> {
  const apiKey = process.env.MAILERLITE_API_KEY
  const groupId = process.env.MAILERLITE_GROUP_ID
  if (!apiKey) return

  const body: Record<string, unknown> = { email }
  if (name) body.name = name
  if (groupId) body.groups = [groupId]

  const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok && res.status !== 409) {
    // 409 = already subscribed — treat as success
    const text = await res.text()
    throw new Error(`MailerLite error ${res.status}: ${text}`)
  }
}

export async function POST(request: NextRequest) {
  // Parse + validate request body
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

  // 1. Store in Supabase (upsert on conflict to silently handle duplicates)
  const db = getServiceClient()
  if (db) {
    const { error } = await db
      .from('newsletter_subscribers')
      .upsert({ email, name: name ?? null, source: 'website' }, { onConflict: 'email' })
    if (error) {
      console.error('[newsletter] Supabase upsert error:', error.message)
      return NextResponse.json({ error: 'Subscription failed. Please try again.' }, { status: 500 })
    }
  }

  // 2. Optionally sync to MailerLite (non-blocking — failure logs but doesn't break the response)
  try {
    await addToMailerLite(email, name)
  } catch (err) {
    console.error('[newsletter] MailerLite sync error:', err instanceof Error ? err.message : err)
    // Do NOT return error — the subscriber is already in Supabase
  }

  return NextResponse.json({ success: true })
}
