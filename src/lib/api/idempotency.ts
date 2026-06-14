/**
 * src/lib/api/idempotency.ts — Idempotency key DAL
 *
 * Prevents duplicate financial transactions caused by client-side double-clicks
 * or network retries. Each unique operation generates a UUID key that is
 * atomically claimed on the server before processing begins.
 *
 * Usage pattern (server-side):
 *   const claimed = await checkAndClaimIdempotencyKey(db, key, 'sos-confirm')
 *   if (!claimed) throw new ApiError(409, 'Duplicate request')
 *   // ... perform the actual operation
 *
 * Keys older than 24 hours are considered expired and a new claim is allowed.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>

export type IdempotencyResourceType =
  | 'sos-confirm'
  | 'submit-release'
  | 'payout-request'

const TTL_HOURS = 24

/**
 * Atomically claim an idempotency key.
 *
 * Returns `true`  when the key was successfully claimed (first use / expired).
 * Returns `false` when the key already exists within the TTL window (duplicate).
 *
 * Uses INSERT ... ON CONFLICT DO NOTHING so that concurrent requests cannot
 * both claim the same key — only the first INSERT wins.
 *
 * Must be called with a service-role client to bypass RLS.
 */
export async function checkAndClaimIdempotencyKey(
  db: DbClient,
  key: string,
  resourceType: IdempotencyResourceType,
  resourceId?: string,
): Promise<boolean> {
  // Clean up expired keys older than TTL to keep the table lean
  const expiry = new Date(Date.now() - TTL_HOURS * 60 * 60 * 1000).toISOString()
  await db.from('idempotency_keys').delete().lt('created_at', expiry)

  // Attempt to insert the key atomically
  const { data, error } = await db
    .from('idempotency_keys')
    .insert({
      key,
      resource_type: resourceType,
      resource_id: resourceId ?? null,
    })
    .select('key')
    .single()

  if (error) {
    // Duplicate key value → key already claimed
    if (
      error.code === '23505' ||
      error.message.includes('duplicate key') ||
      error.message.includes('unique constraint')
    ) {
      return false
    }
    throw new Error(`Idempotency check failed: ${error.message}`)
  }

  return data !== null
}

/**
 * Update the resource_id on a previously claimed key once the resource
 * has been created. Useful for returning the ID of a created record to
 * the caller on retry.
 */
export async function updateIdempotencyKeyResourceId(
  db: DbClient,
  key: string,
  resourceId: string,
): Promise<void> {
  const { error } = await db
    .from('idempotency_keys')
    .update({ resource_id: resourceId })
    .eq('key', key)

  if (error) {
    // Non-fatal — the primary protection is the INSERT above
    console.warn('[idempotency] Failed to update resource_id:', error.message)
  }
}
