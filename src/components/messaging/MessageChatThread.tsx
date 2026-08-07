'use client'

import { useEffect, useRef } from 'react'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { cn } from '@/lib/utils'

export type ChatThreadItem = {
  id: string
  body: string
  bodyHtml?: string | null
  sentAt: string
  /** Current-user side (right-aligned bubble). */
  isOwn: boolean
  senderLabel: string
}

export interface MessageChatThreadProps {
  items: ChatThreadItem[]
  className?: string
  /** Accessible name for the conversation list */
  'aria-label'?: string
}

function formatBubbleTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Chat-style message thread: chronological bubbles, own messages on the right.
 */
export function MessageChatThread({
  items,
  className,
  'aria-label': ariaLabel = 'Conversation',
}: MessageChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const sorted = [...items].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  )
  const lastItemId = sorted[sorted.length - 1]?.id
  const itemCount = sorted.length

  useEffect(() => {
    const node = endRef.current
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [itemCount, lastItemId])

  if (sorted.length === 0) return null

  return (
    <div
      role="log"
      aria-label={ariaLabel}
      aria-live="polite"
      className={cn('flex flex-col gap-3', className)}
    >
      {sorted.map((item) => (
        <div
          key={item.id}
          className={cn('flex w-full', item.isOwn ? 'justify-end' : 'justify-start')}
        >
          <article
            className={cn(
              'max-w-[min(100%,28rem)] rounded-2xl px-3.5 py-2.5 shadow-sm',
              item.isOwn
                ? 'rounded-br-md bg-primary text-primary-foreground'
                : 'rounded-bl-md border border-border bg-card text-foreground',
            )}
          >
            <header className="mb-1 flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  'text-[11px] font-semibold truncate',
                  item.isOwn ? 'text-primary-foreground/85' : 'text-muted-foreground',
                )}
              >
                {item.senderLabel}
              </span>
              <time
                dateTime={item.sentAt}
                className={cn(
                  'text-[10px] tabular-nums shrink-0',
                  item.isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground',
                )}
              >
                {formatBubbleTime(item.sentAt)}
              </time>
            </header>
            {item.bodyHtml ? (
              <div
                suppressHydrationWarning
                className={cn(
                  'prose prose-sm max-w-none text-sm leading-relaxed',
                  item.isOwn
                    ? 'prose-invert [&_a]:text-primary-foreground [&_a]:underline'
                    : 'dark:prose-invert',
                )}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.bodyHtml) }}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{item.body}</p>
            )}
          </article>
        </div>
      ))}
      <div ref={endRef} aria-hidden="true" className="h-px w-full shrink-0" />
    </div>
  )
}
