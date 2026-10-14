/**
 * Server-only DOM for sanitizeHtml. Loaded from instrumentation.ts so client
 * bundles never import jsdom.
 */

import { JSDOM } from 'jsdom'
import DOMPurify from 'dompurify'
import type { DOMPurify as DOMPurifyInstance, WindowLike } from 'dompurify'
import type { ServerHtmlSanitizer } from '@/lib/sanitizeHtml'

type PurifyFactory = DOMPurifyInstance & ((root: WindowLike) => DOMPurifyInstance)

export function createServerSanitizer(): ServerHtmlSanitizer {
  const { window } = new JSDOM('')
  const factory = DOMPurify as PurifyFactory
  const purify = factory(window as unknown as WindowLike)
  return {
    purify,
    createElement: (tag: string) => window.document.createElement(tag),
  }
}
