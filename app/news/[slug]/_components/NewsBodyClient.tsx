'use client'

/**
 * NewsBodyClient — Client component that safely renders HTML news content.
 *
 * Uses DOMPurify to sanitise admin-authored HTML before injecting it into
 * the DOM. Images in the HTML are proxied through wsrv.nl (via processHtmlImages)
 * for WebP conversion, resizing, and CDN caching.
 * Isolated as a minimal 'use client' leaf so the parent RSC remains server-rendered.
 */

import DOMPurify from 'dompurify'
import { processHtmlImages } from '@/lib/imageUtils'

interface NewsBodyClientProps {
  content: string
}

export function NewsBodyClient({ content }: NewsBodyClientProps) {
  const sanitized = processHtmlImages(DOMPurify.sanitize(content, { ADD_ATTR: ['target'] }))
  return (
    <div
      className="prose prose-invert prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
