'use client'

import { marked } from 'marked'
import { useMemo } from 'react'

interface DatenschutzContentProps {
  content: string
}

/**
 * Renders Markdown privacy policy content as safe HTML.
 * Isolated as a minimal 'use client' leaf so the parent RSC stays server-rendered.
 */
export function DatenschutzContent({ content }: DatenschutzContentProps) {
  const html = useMemo(() => {
    const result = marked.parse(content, { async: false })
    return typeof result === 'string' ? result : ''
  }, [content])

  return (
    <div
      className="prose prose-invert prose-sm max-w-none text-foreground/90 leading-relaxed
        [&_h2]:text-lg [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-wider [&_h2]:mt-8 [&_h2]:mb-3
        [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1
        [&_p]:text-muted-foreground [&_p]:mb-4
        [&_a]:text-accent [&_a]:underline [&_a]:hover:no-underline
        [&_strong]:text-foreground [&_strong]:font-semibold
        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
