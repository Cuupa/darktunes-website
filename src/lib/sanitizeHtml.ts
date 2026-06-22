/**
 * src/lib/sanitizeHtml.ts
 *
 * Isomorphic HTML sanitizer.
 *
 * • Client (browser): delegates to DOMPurify which does a thorough,
 *   spec-correct sanitization using the real DOM parser.
 *
 * • Server (Node.js / Next.js SSR): DOMPurify cannot run without a DOM, so we
 *   apply a conservative, defense-in-depth regex pass that removes the most
 *   dangerous XSS vectors before the HTML reaches the initial SSR response.
 *   DOMPurify then runs again during client hydration, catching anything the
 *   server pass may have missed.
 *
 * Import this helper everywhere `dangerouslySetInnerHTML` is used instead of
 * the raw `typeof window !== 'undefined' ? DOMPurify.sanitize(html) : html`
 * anti-pattern that leaves SSR output unsanitized.
 */

import DOMPurify from 'dompurify'

type SanitizeOptions = Parameters<typeof DOMPurify.sanitize>[1]

// ---------------------------------------------------------------------------
// Server-side regex sanitizer
// ---------------------------------------------------------------------------

/**
 * Removes the most common XSS vectors from an HTML string without requiring
 * a DOM environment.  Not a full parser — it is a defense-in-depth measure
 * intended to be used together with client-side DOMPurify.
 */
function serverSanitize(html: string): string {
  return (
    html
      // Strip <script> elements including their content
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      // Strip <style> elements including their content
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      // Strip inherently dangerous block elements entirely
      .replace(
        /<\/?(object|embed|applet|form|base|meta|link|input|button|select|textarea)\b[^>]*\/?>/gi,
        '',
      )
      // Remove on* event handler attributes (onclick=, onerror=, etc.)
      .replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
      // Neutralise javascript: pseudo-protocol in href / src / action
      .replace(
        /(href|src|action|xlink:href)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi,
        '$1=""',
      )
      .replace(/(href|src|action|xlink:href)\s*=\s*javascript:[^\s>]*/gi, '$1=""')
      // Neutralise data: URIs in href / src / action (images are safe, others are not)
      .replace(
        /(href|src|action)\s*=\s*(['"])\s*data:(?!image\/(?:png|jpe?g|gif|webp|svg\+xml))[^'"]*\2/gi,
        '$1=""',
      )
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sanitize an HTML string safely on both server and client.
 *
 * Accepts an optional `options` object that is forwarded to DOMPurify on the
 * client (e.g. `{ ALLOWED_TAGS: [...] }`).
 */
export function sanitizeHtml(
  html: string,
  // Use Parameters to match exactly what DOMPurify.sanitize accepts
  options?: SanitizeOptions,
): string {
  if (!html) return ''

  if (typeof window === 'undefined') {
    // Server: apply the regex-based sanitizer
    return serverSanitize(html)
  }

  // Client: full DOMPurify sanitization
  const addAttr = Array.isArray(options?.ADD_ATTR) ? options.ADD_ATTR : []
  const mergedOptions: SanitizeOptions = {
    ...options,
    ADD_ATTR: ['target', ...addAttr.filter((attr) => attr !== 'target')],
  }
  return DOMPurify.sanitize(html, mergedOptions)
}
