/**
 * Browser stand-in. The real file imports jsdom. next.config aliases this
 * module in the client build so jsdom never ships to the browser.
 * The browser path of sanitizeHtml does not call this.
 */

import type { ServerHtmlSanitizer } from '@/lib/sanitizeHtml'

export function createServerSanitizer(): ServerHtmlSanitizer {
  throw new Error('Server HTML sanitizer is not available in the browser')
}
