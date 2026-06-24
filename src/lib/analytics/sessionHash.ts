/**
 * Privacy-preserving session hashing for website page-event analytics.
 */

import { createHash } from 'node:crypto'

const PAGE_EVENT_SALT = 'darktunes-page-event-v1'

export function hashSessionForPageEvents(ip: string, clientSessionId: string): string {
  return createHash('sha256')
    .update(`${PAGE_EVENT_SALT}:${ip}:${clientSessionId}`)
    .digest('hex')
}