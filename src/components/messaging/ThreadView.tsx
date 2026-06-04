'use client'

import { useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import { StarFour } from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'framer-motion'
import type { ArtistReply, LabelMessage } from '@/types'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { MessageActions } from './MessageActions'

interface ThreadViewProps {
  messages: LabelMessage[]
  repliesByMessageId: Record<string, ArtistReply[]>
  artists: Array<{ id: string; name: string }>
  onStar: (id: string, starred: boolean) => void
  onDelete: (id: string) => void
  onExport: (id: string) => void
  onMarkRead?: (id: string) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
}

function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html
  return DOMPurify.sanitize(html)
}

export function ThreadView({
  messages,
  repliesByMessageId,
  artists,
  onStar,
  onDelete,
  onExport,
  onMarkRead,
  selectedIds,
  onToggleSelect,
}: ThreadViewProps) {
  const prefersReducedMotion = useReducedMotion()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpand = (message: LabelMessage) => {
    const willExpand = expandedId !== message.id
    setExpandedId(willExpand ? message.id : null)
    if (willExpand && !message.read && onMarkRead) {
      onMarkRead(message.id)
    }
  }

  const artistNameById = useMemo(() => new Map(artists.map((artist) => [artist.id, artist.name])), [artists])

  const groupedMessages = useMemo(() => {
    const groups = new Map<string, LabelMessage[]>()
    messages.forEach((message) => {
      const existing = groups.get(message.artistId) ?? []
      existing.push(message)
      groups.set(message.artistId, existing)
    })

    return Array.from(groups.entries())
      .map(([artistId, items]) => ({
        artistId,
        artistName: artistNameById.get(artistId) ?? 'Unknown Artist',
        unreadCount: items.filter((item) => !item.read && !item.deletedAt).length,
        items: [...items].sort((a, b) => {
          const aUnread = !a.read && !a.deletedAt ? 0 : 1
          const bUnread = !b.read && !b.deletedAt ? 0 : 1
          if (aUnread !== bUnread) return aUnread - bUnread
          return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
        }),
      }))
      .sort((a, b) => a.artistName.localeCompare(b.artistName))
  }, [artistNameById, messages])

  if (messages.length === 0) {
    return <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No messages found.</div>
  }

  return (
    <Accordion type="multiple" defaultValue={groupedMessages.map((group) => group.artistId)} className="rounded-lg border border-border px-4">
      {groupedMessages.map((group) => (
        <AccordionItem key={group.artistId} value={group.artistId}>
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <span className="text-base font-semibold">{group.artistName}</span>
              {group.unreadCount > 0 && <Badge>{group.unreadCount} unread</Badge>}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            {group.items.map((message) => {
              const replies = repliesByMessageId[message.id] ?? []
              const isExpanded = expandedId === message.id
              const isDeleted = Boolean(message.deletedAt)
              const isUnread = !message.read && !isDeleted

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                  className={[
                    'rounded-lg border p-4 cursor-pointer transition-colors',
                    isDeleted
                      ? 'border-border bg-muted/20 opacity-60'
                      : isUnread
                        ? 'border-border border-l-[3px] border-l-primary bg-primary/5'
                        : 'border-border bg-card/40',
                  ].join(' ')}
                  onClick={() => toggleExpand(message)}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="pt-1" onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(message.id)}
                          aria-label={`Select ${message.subject}`}
                          onCheckedChange={() => onToggleSelect(message.id)}
                        />
                      </div>
                      <button
                        type="button"
                        className="space-y-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={(e) => { e.stopPropagation(); toggleExpand(message) }}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={isUnread ? 'font-bold' : 'font-semibold'}>{message.subject}</span>
                          {message.starred && (
                            <Badge variant="secondary" className="gap-1">
                              <StarFour size={14} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                              Starred
                            </Badge>
                          )}
                          {isUnread && <Badge>Unread</Badge>}
                          {isDeleted && <Badge variant="outline">Deleted</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{new Date(message.sentAt).toLocaleString()}</p>
                      </button>
                    </div>
                    <div onClick={(event) => event.stopPropagation()}>
                      <MessageActions
                        messageId={message.id}
                        starred={Boolean(message.starred)}
                        read={Boolean(message.read)}
                        deletedAt={message.deletedAt ?? null}
                        onStar={onStar}
                        onDelete={onDelete}
                        onExport={onExport}
                        onMarkRead={onMarkRead}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t border-border pt-4">
                      {message.bodyHtml ? (
                        <div
                          className="prose prose-invert max-w-none break-words"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.bodyHtml) }}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm break-words">{message.body}</p>
                      )}

                      {replies.length > 0 && (
                        <div className="space-y-3 border-l border-border pl-4">
                          {replies.map((reply) => (
                            <div key={reply.id} className="rounded-md border border-border bg-background/60 p-3">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Artist reply</p>
                              {reply.bodyHtml ? (
                                <div
                                  className="prose prose-invert max-w-none break-words text-sm"
                                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(reply.bodyHtml) }}
                                />
                              ) : (
                                <p className="whitespace-pre-wrap text-sm break-words">{reply.body}</p>
                              )}
                              <p className="mt-3 text-xs text-muted-foreground">{new Date(reply.sentAt).toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
