/**
 * src/lib/cronAuth.ts
 *
 * Shared cron authentication helper used by all sync route handlers.
 */

import { timingSafeEqual } from 'node:crypto'

/**
 * Verifies that `authHeader` equals `Bearer ${cronSecret}` using a
 * timing-safe comparison to prevent timing attacks.
 */
export function isValidCronSecret(authHeader: string, cronSecret: string): boolean {
  const expected = `Bearer ${cronSecret}`
  const authBuffer = Buffer.from(authHeader, 'utf-8')
  const expectedBuffer = Buffer.from(expected, 'utf-8')
  if (authBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(authBuffer, expectedBuffer)
}
