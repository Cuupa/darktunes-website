'use server'

/**
 * app/actions/newsletter.ts
 *
 * Server Action: subscribe a user to the newsletter (Double Opt-In, step 1).
 *
 * Flow:
 *   1. Validates the email with Zod.
 *   2. Generates a cryptographically secure UUID as the verification_token.
 *   3. Inserts the subscriber into Supabase with status='pending'.
 *   4. Returns a serialisable result — the Client Component renders the
 *      appropriate success / error state from this.
 *
 * The confirmation email is sent asynchronously by a Supabase Edge Function
 * that is triggered by the DB INSERT webhook — NOT from this Server Action.
 * This keeps the Server Action fast (no external HTTP call in the hot path)
 * and decouples delivery from data storage.
 *
 * Anti-enumeration: duplicate-email errors are silently treated as success so
 * attackers cannot probe which addresses are already registered.
 */

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createPendingSubscriber } from '@/lib/api/newsletter'

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const subscribeSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  name: z.string().max(120).optional(),
})

// ---------------------------------------------------------------------------
// Return type (serialisable — no NextResponse / class instances)
// ---------------------------------------------------------------------------

export type SubscribeActionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string> }

// ---------------------------------------------------------------------------
// Service-role client (never exposed to the browser)
// ---------------------------------------------------------------------------

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function subscribeToNewsletter(
  formData: FormData,
): Promise<SubscribeActionResult> {
  // 1. Validate input
  const raw = {
    email: formData.get('email'),
    name: formData.get('name') || undefined,
  }

  const parsed = subscribeSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0])
      fieldErrors[field] = issue.message
    }
    return { success: false, error: 'Validation failed', fieldErrors }
  }

  const { email, name } = parsed.data

  // 2. Get Supabase service-role client
  const db = getServiceClient()
  if (!db) {
    // Supabase not configured — fail gracefully (dev / CI environments)
    console.warn('[newsletter] Supabase not configured; skipping DB insert.')
    return { success: true }
  }

  // 3. Generate a secure verification token
  const verificationToken = randomUUID()

  // 4. Insert as pending subscriber — duplicate email is silently ignored
  try {
    await createPendingSubscriber(db, email, verificationToken, name)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Postgres unique-constraint violation → email already registered
    if (message.includes('23505') || message.toLowerCase().includes('duplicate')) {
      // Silent success: do not reveal whether the address is registered
      return { success: true }
    }
    console.error('[newsletter] createPendingSubscriber error:', message)
    return { success: false, error: 'Subscription failed. Please try again.' }
  }

  return { success: true }
}
