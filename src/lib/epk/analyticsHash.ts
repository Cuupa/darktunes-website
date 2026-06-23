/**
 * src/lib/epk/analyticsHash.ts
 *
 * Privacy-preserving IP hashing for EPK download analytics (GDPR Art. 6(1)(f)).
 */

import { createHash } from 'node:crypto'

const IP_HASH_SALT = 'darktunes-epk-download-v1'

export function hashIpForAnalytics(ip: string): string {
  return createHash('sha256').update(`${IP_HASH_SALT}:${ip}`).digest('hex')
}