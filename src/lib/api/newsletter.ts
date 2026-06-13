/**
 * src/lib/api/newsletter.ts
 *
 * DEPRECATED: The newsletter_subscribers table has been removed.
 * Newsletter subscriptions are now handled through Shopify.
 *
 * These stub functions are kept temporarily to prevent build errors in routes
 * that still reference them. They will throw runtime errors if called.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>

// ---------------------------------------------------------------------------
// Domain type (kept for backward compatibility)
// ---------------------------------------------------------------------------

export interface NewsletterSubscriber {
  id: string
  email: string
  name: string | undefined
  source: string
  status: 'pending' | 'subscribed' | 'unsubscribed'
  verificationToken: string | undefined
  unsubscribeToken: string | undefined
  subscribedAt: string
}

// ---------------------------------------------------------------------------
// Stub functions (throw errors)
// ---------------------------------------------------------------------------

/**
 * @deprecated Newsletter feature moved to Shopify
 */
export async function createPendingSubscriber(
  _db: DbClient,
  _email: string,
  _verificationToken: string,
  _name?: string,
): Promise<NewsletterSubscriber> {
  throw new Error('Newsletter feature has been migrated to Shopify')
}

/**
 * @deprecated Newsletter feature moved to Shopify
 */
export async function verifySubscriberToken(
  _db: DbClient,
  _token: string,
): Promise<NewsletterSubscriber | null> {
  throw new Error('Newsletter feature has been migrated to Shopify')
}

/**
 * @deprecated Newsletter feature moved to Shopify
 */
export async function unsubscribeByToken(
  _db: DbClient,
  _token: string,
): Promise<NewsletterSubscriber | null> {
  throw new Error('Newsletter feature has been migrated to Shopify')
}
