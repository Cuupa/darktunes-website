'use client'

import { marked } from 'marked'
import { useMemo } from 'react'
import { processHtmlImages } from '@/lib/imageUtils'
import { sanitizeHtml } from '@/lib/sanitizeHtml'

interface RichFaqContentProps {
  content: string
  className?: string
}

function isHtml(str: string): boolean {
  return /^\s*<[a-z]/i.test(str)
}

export function RichFaqContent({ content, className }: RichFaqContentProps) {
  const html = useMemo(() => {
    if (!content) return ''
    const raw = isHtml(content)
      ? content
      : (() => {
          const result = marked.parse(content, { async: false })
          return typeof result === 'string' ? result : ''
        })()
    return processHtmlImages(sanitizeHtml(raw))
  }, [content])

  return (
    <div
      suppressHydrationWarning
      className={
        className ??
        'prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed ' +
          '[&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-4 [&_h2]:mb-2 ' +
          '[&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1 ' +
          '[&_p]:mb-3 [&_a]:text-accent [&_a]:underline [&_a]:hover:no-underline ' +
          '[&_strong]:text-foreground ' +
          '[&_ul]:list-disc [&_ul]:list-inside [&_ul]:pl-1 [&_ul]:my-2 [&_ul]:space-y-1 ' +
          '[&_ol]:list-decimal [&_ol]:list-inside [&_ol]:pl-1 [&_ol]:my-2 [&_ol]:space-y-1 ' +
          '[&_.tiptap-file-link]:inline-flex [&_.tiptap-file-link]:items-center [&_.tiptap-file-link]:gap-1 ' +
          '[&_.tiptap-file-link]:rounded-md [&_.tiptap-file-link]:border [&_.tiptap-file-link]:border-border ' +
          '[&_.tiptap-file-link]:px-2 [&_.tiptap-file-link]:py-1 [&_.tiptap-file-link]:text-sm'
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}