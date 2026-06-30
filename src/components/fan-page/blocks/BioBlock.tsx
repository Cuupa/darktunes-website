'use client'

import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { processHtmlImages } from '@/lib/imageUtils'
import { cn } from '@/lib/utils'

interface BioBlockProps {
  content?: string
  title?: string
}

export function BioBlock({ content, title }: BioBlockProps) {
  const html = content?.trim()
  if (!html) {
    return <p className="text-sm opacity-60">—</p>
  }

  const safe = processHtmlImages(sanitizeHtml(html))

  return (
    <div>
      {title ? <h2 className="mb-4 text-2xl font-bold tracking-tight">{title}</h2> : null}
      <div
        className={cn('prose prose-invert max-w-none text-base leading-relaxed opacity-90')}
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    </div>
  )
}