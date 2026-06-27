/**
 * src/lib/zammad/fingerprint.ts
 *
 * Stable fingerprints for error deduplication and known-error filtering.
 */

import { createHash } from 'crypto'

export function buildErrorFingerprint(
  source: string,
  message: string,
  viewPath?: string | null,
): string {
  const payload = [
    source.trim().toLowerCase(),
    message.trim().slice(0, 500),
    (viewPath ?? '').trim().toLowerCase(),
  ].join('|')

  return createHash('sha256').update(payload).digest('hex')
}