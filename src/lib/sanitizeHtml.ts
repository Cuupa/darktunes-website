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
// Iframe-Allowlist
// ---------------------------------------------------------------------------
const ALLOWED_IFRAME_HOSTS = [
  'youtube.com',
  'youtube-nocookie.com',
  'open.spotify.com',
  'w.soundcloud.com',
  'widget.bandsintown.com',
]

function isAllowedIframeSrc(src: string): boolean {
  try {
    const url = new URL(src)
    return url.protocol === 'https:' && ALLOWED_IFRAME_HOSTS.includes(url.hostname)
  } catch {
    return false
  }
}

function stripDisallowedIframes(cleanHtml: string): string {
  if (!cleanHtml.includes('<iframe')) return cleanHtml
  const template = document.createElement('template')
  template.innerHTML = cleanHtml
  template.content.querySelectorAll('iframe').forEach((iframe) => {
    const src = iframe.getAttribute('src') || ''
    if (!isAllowedIframeSrc(src)) {
      iframe.remove()
    }
  })
  return template.innerHTML
}

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
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(
        /<\/?(iframe|object|embed|applet|form|base|meta|link|input|button|select|textarea)\b[^>]*\/?>/gi,
        '',
      )
      .replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
      .replace(
        /(href|src|action|xlink:href)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi,
        '$1=""',
      )
      .replace(/(href|src|action|xlink:href)\s*=\s*javascript:[^\s>]*/gi, '$1=""')
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
    return serverSanitize(html)
  }

  const addAttr = Array.isArray(options?.ADD_ATTR) ? options.ADD_ATTR : []
  const addTags = Array.isArray(options?.ADD_TAGS) ? options.ADD_TAGS : []
  const wantsIframe = addTags.includes('iframe')

  const iframeAttrs = wantsIframe
    ? ['src', 'allow', 'allowfullscreen', 'frameborder', 'loading', 'title', 'width', 'height']
    : []

  const forbidAttr = Array.isArray(options?.FORBID_ATTR) ? options.FORBID_ATTR : []

  const mergedOptions: SanitizeOptions = {
    ...options,
    ADD_ATTR: [
      'target',
      ...addAttr.filter((a) => a !== 'target'),
      ...iframeAttrs.filter((a) => !addAttr.includes(a)),
    ],
    FORBID_ATTR: ['srcdoc', ...forbidAttr],
  }

  const clean = DOMPurify.sanitize(html, mergedOptions)
  return wantsIframe ? stripDisallowedIframes(clean) : clean
}