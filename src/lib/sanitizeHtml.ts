/**
 * src/lib/sanitizeHtml.ts
 *
 * Isomorphic HTML sanitizer. The browser uses DOMPurify. The server uses the
 * same library on a jsdom window registered at startup. If that window is
 * missing, tags are escaped so a payload cannot run in the first HTML.
 *
 * Import this helper everywhere `dangerouslySetInnerHTML` is used.
 */

import DOMPurify from 'dompurify'
import type { DOMPurify as DOMPurifyInstance } from 'dompurify'
import { createServerSanitizer } from 'darktunes-sanitize-html-server'
import { stripEmojisFromHtml } from '@/lib/stripEmojis'

type SanitizeOptions = Parameters<typeof DOMPurify.sanitize>[1]

interface HtmlRoot {
  innerHTML: string
  querySelectorAll(selector: string): ArrayLike<{
    getAttribute(name: string): string | null
    remove(): void
  }>
}

export interface ServerHtmlSanitizer {
  purify: DOMPurifyInstance
  createElement: (tag: string) => HtmlRoot
}

const ALLOWED_IFRAME_DOMAINS = [
  'youtube.com',
  'youtube-nocookie.com',
  'open.spotify.com',
  'w.soundcloud.com',
  'widget.bandsintown.com',
]

const SERVER_SANITIZER_KEY = '__darktunesServerSanitizer'

function getServerSanitizer(): ServerHtmlSanitizer | null {
  const holder = globalThis as typeof globalThis & {
    [SERVER_SANITIZER_KEY]?: ServerHtmlSanitizer
  }
  if (holder[SERVER_SANITIZER_KEY]) return holder[SERVER_SANITIZER_KEY]
  try {
    holder[SERVER_SANITIZER_KEY] = createServerSanitizer()
    return holder[SERVER_SANITIZER_KEY]
  } catch {
    return null
  }
}

function isAllowedIframeSrc(src: string): boolean {
  try {
    const url = new URL(src)
    if (url.protocol !== 'https:') return false
    return ALLOWED_IFRAME_DOMAINS.some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    )
  } catch {
    return false
  }
}

function escapeTags(html: string): string {
  return html.replace(/[<>]/g, (char) => (char === '<' ? '&lt;' : '&gt;'))
}

function stripDisallowedIframes(cleanHtml: string, createElement: (tag: string) => HtmlRoot): string {
  if (!cleanHtml.includes('<iframe')) return cleanHtml
  const root = createElement('div')
  root.innerHTML = cleanHtml
  const frames = root.querySelectorAll('iframe')
  for (let i = 0; i < frames.length; i++) {
    const iframe = frames[i]
    if (!iframe) continue
    if (!isAllowedIframeSrc(iframe.getAttribute('src') || '')) iframe.remove()
  }
  return root.innerHTML
}

function sanitizeWith(
  purify: DOMPurifyInstance,
  html: string,
  options: SanitizeOptions | undefined,
  createElement: (tag: string) => HtmlRoot,
): string {
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
      ...addAttr.filter((attr) => attr !== 'target'),
      ...iframeAttrs.filter((attr) => !addAttr.includes(attr)),
    ],
    FORBID_ATTR: ['srcdoc', ...forbidAttr],
  }

  const clean = purify.sanitize(html, mergedOptions)
  const iframeSafe = wantsIframe ? stripDisallowedIframes(clean, createElement) : clean
  return stripEmojisFromHtml(iframeSafe)
}

export function sanitizeHtml(html: string, options?: SanitizeOptions): string {
  if (!html) return ''

  if (typeof window !== 'undefined') {
    return sanitizeWith(DOMPurify, html, options, (tag) => document.createElement(tag) as HtmlRoot)
  }

  const server = getServerSanitizer()
  if (!server) return stripEmojisFromHtml(escapeTags(html))
  return sanitizeWith(server.purify, html, options, server.createElement)
}
