'use client'

/**
 * NewsBodyClient — Client component that safely renders HTML news content.
 *
 * Uses DOMPurify to sanitise admin-authored HTML before injecting it into
 * the DOM. Isolated as a minimal 'use client' leaf so the parent RSC
 * remains server-rendered.
 */

import DOMPurify from 'dompurify'

interface NewsBodyClientProps {
  content: string
}

export function NewsBodyClient({ content }: NewsBodyClientProps) {
  return (
    <div
      className="prose prose-invert prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
    />
  )
}
