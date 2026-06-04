'use client'

import { marked } from 'marked'
import { useMemo } from 'react'

interface DatenschutzContentProps {
  content: string
}

/** Returns true when content looks like HTML rather than Markdown. */
function isHtml(str: string) {
  return /^\s*<[a-z]/i.test(str)
}

/**
 * Renders the privacy policy content as safe HTML.
 * Supports both HTML (produced by TiptapEditor) and legacy Markdown.
 * Isolated as a minimal 'use client' leaf so the parent RSC stays server-rendered.
 */
export function DatenschutzContent({ content }: DatenschutzContentProps) {
  const html = useMemo(() => {
    if (!content) return ''
    if (isHtml(content)) return content
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
