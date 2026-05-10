/**
 * src/lib/api/newsletter.ts
 *
 * Data Access Layer for the `newsletter_subscribers` table.
 *
 * Supports the Double Opt-In (DOI) subscription flow:
 *   1. createPendingSubscriber — inserts a row with status='pending' and a
 *      unique verification_token (UUID).
 *   2. verifySubscriberToken   — finds a pending row by token and flips its
 *      status to 'subscribed', returning the subscriber's email.
 *
 * Every function accepts a SupabaseClient as its first argument (IoC / DAL
 * pattern). Callers MUST pass a service-role client so that writes bypass RLS.
 *
 * Errors:
 *   - On database error: throws Error(error.message).
 *   - On duplicate email (createPendingSubscriber): throws Error with code
 *     '23505' in the message so callers can detect it without depending on
 *     Postgres error codes directly.
 *   - verifySubscriberToken returns null when the token is unknown / already used.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type SubscriberRow = Database['public']['Tables']['newsletter_subscribers']['Row']

// ---------------------------------------------------------------------------
// Domain type
// ---------------------------------------------------------------------------

export interface NewsletterSubscriber {
  id: string
  email: string
  name: string | undefined
  source: string
  status: 'pending' | 'subscribed'
  verificationToken: string | undefined
  subscribedAt: string
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToSubscriber(row: SubscriberRow): NewsletterSubscriber {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? undefined,
    source: row.source,
    status: row.status,
    verificationToken: row.verification_token ?? undefined,
    subscribedAt: row.subscribed_at,
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Inserts a new subscriber row with status='pending' and the supplied token.
 *
 * Throws if the email already exists (Postgres error code 23505).
 * The caller should catch this and return a silent success to the user —
 * never reveal whether an address is already registered (anti-enumeration).
 */
export async function createPendingSubscriber(
  db: DbClient,
  email: string,
  verificationToken: string,
  name?: string,
): Promise<NewsletterSubscriber> {
  const { data: row, error } = await db
    .from('newsletter_subscribers')
    .insert({
      email,
      name: name ?? null,
      source: 'website',
      status: 'pending',
      verification_token: verificationToken,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from createPendingSubscriber')
  return rowToSubscriber(row as SubscriberRow)
}

/**
 * Looks up a pending subscriber by verification_token and marks them as
 * 'subscribed'. Clears the token so it cannot be reused.
 *
 * Returns the subscriber (with updated status) or null if the token is
 * unknown, already consumed, or belongs to a non-pending subscriber.
 */
export async function verifySubscriberToken(
  db: DbClient,
  token: string,
): Promise<NewsletterSubscriber | null> {
  // Only match rows that are still pending — prevents token replay.
  const { data: row, error } = await db
    .from('newsletter_subscribers')
    .update({ status: 'subscribed', verification_token: null })
    .eq('verification_token', token)
    .eq('status', 'pending')
    .select()
    .single()

  if (error) {
    // PGRST116 = "No rows found" — token is invalid or already used.
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new Error(error.message)
  }

  return row ? rowToSubscriber(row as SubscriberRow) : null
}
