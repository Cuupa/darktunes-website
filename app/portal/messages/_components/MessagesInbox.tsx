'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import { toast } from 'sonner'
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js'
import { CaretDown, ChatCircleText, EnvelopeSimple } from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'framer-motion'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { PortalEmptyState } from '@/components/portal/PortalEmptyState'
import { RichTextEditor } from '@/components/messaging/RichTextEditor'
import type { ArtistReply, LabelMessage } from '@/types'
import type { Database } from '@/types/database'
import { markPortalMessageRead } from '../_actions/messages'
import { sendPortalReply } from '../_actions/reply'
import { REPLY_MAX_LENGTH, REPLY_MIN_LENGTH } from '../_constants'

interface MessagesInboxProps {
  initialMessages: LabelMessage[]
  initialRepliesByMessageId: Record<string, ArtistReply[]>
}

interface ReplyDraft {
  html: string
  text: string
}

type MessageRow = Database['public']['Tables']['label_messages']['Row']

function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html
  return DOMPurify.sanitize(html)
}

function rowToMessage(row: MessageRow): LabelMessage {
  return {
    id: row.id,
    artistId: row.artist_id,
    subject: row.subject,
    body: row.body,
    bodyHtml: row.body_html,
    read: row.read,
    readAt: row.read_at,
    starred: row.starred,
    deletedAt: row.deleted_at,
    sentAt: row.sent_at,
  }
}

export function MessagesInbox({ initialMessages, initialRepliesByMessageId }: MessagesInboxProps) {
  const t = useTranslations('portal')

  const prefersReducedMotion = useReducedMotion()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [messages, setMessages] = useState(initialMessages)
  const [repliesByMessageId, setRepliesByMessageId] = useState(initialRepliesByMessageId)
  const [replyDraftByMessageId, setReplyDraftByMessageId] = useState<Record<string, ReplyDraft>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [sendingReplyFor, setSendingReplyFor] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    let isMounted = true

    const subscribe = async () => {
      let artistId: string | null = initialMessages[0]?.artistId ?? null
      if (!artistId) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const { data: artist } = await supabase.from('artists').select('id').eq('user_id', user.id).maybeSingle()
          artistId = artist?.id ?? null
        }
      }

      if (!artistId || !isMounted) return

      const channel = supabase
        .channel(`portal-label-messages-${artistId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'label_messages',
            filter: `artist_id=eq.${artistId}`,
          },
          (payload: RealtimePostgresInsertPayload<MessageRow>) => {
            const nextMessage = rowToMessage(payload.new)
            setMessages((current) => [nextMessage, ...current.filter((message) => message.id !== nextMessage.id)])
            setAnnouncement(`New message received: ${nextMessage.subject}`)
          },
        )
        .subscribe()

      return () => {
        void supabase.removeChannel(channel)
      }
    }

    let cleanup: (() => void) | undefined
    void subscribe().then((dispose) => {
      cleanup = dispose
    })

    return () => {
      isMounted = false
      cleanup?.()
    }
  }, [initialMessages, supabase])

  const handleRead = async (id: string) => {
    setLoadingId(id)
    try {
      await markPortalMessageRead(id)
      setMessages((prev) => prev.map((message) => (message.id === id ? { ...message, read: true } : message)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark message as read')
    } finally {
      setLoadingId(null)
    }
  }

  const handleSendReply = async (messageId: string) => {
    const draft = replyDraftByMessageId[messageId] ?? { html: '', text: '' }
    const body = draft.text.trim()
    if (body.length < REPLY_MIN_LENGTH || body.length > REPLY_MAX_LENGTH) {
      toast.error(t('messages_reply_error'))
      return
    }

    setSendingReplyFor(messageId)
    try {
      const reply = await sendPortalReply(messageId, body, draft.html)
      setRepliesByMessageId((prev) => ({
        ...prev,
        [messageId]: [...(prev[messageId] ?? []), reply],
      }))
      setReplyDraftByMessageId((prev) => ({ ...prev, [messageId]: { html: '', text: '' } }))
      toast.success(t('messages_reply_sent'))
    } catch {
      toast.error(t('messages_reply_error'))
    } finally {
      setSendingReplyFor(null)
    }
  }

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <h1 className="text-3xl font-bold">{t('messages_heading')}</h1>
      <div className="rounded-lg border border-border divide-y divide-border">
        {messages.map((message) => {
          const replies = repliesByMessageId[message.id] ?? []
          return (
            <motion.article
              key={message.id}
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              className="space-y-4 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{message.subject}</h2>
                {!message.read && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loadingId === message.id}
                    onClick={() => void handleRead(message.id)}
                  >
                    {t('messages_mark_read')}
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{new Date(message.sentAt).toLocaleString()}</p>
              {message.bodyHtml ? (
                <div
                  className="prose prose-invert max-w-none break-words"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.bodyHtml) }}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm break-words">{message.body}</p>
              )}

              <Collapsible className="rounded-md border border-border bg-card/40">
                <CollapsibleTrigger className="flex min-h-[44px] w-full items-center justify-between px-3 py-2 text-sm font-medium">
                  <span className="inline-flex items-center gap-2">
                    <ChatCircleText size={16} aria-hidden="true" />
                    {t('messages_reply')}
                  </span>
                  <CaretDown size={16} className="text-muted-foreground" aria-hidden="true" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 border-t border-border p-3">
                  <div className="space-y-2">
                    <label className="sr-only" htmlFor={`reply-${message.id}`}>
                      {t('messages_reply')}
                    </label>
                    <div id={`reply-${message.id}`}>
                      <RichTextEditor
                        value={replyDraftByMessageId[message.id]?.html ?? ''}
                        minHeight={120}
                        placeholder={t('messages_reply_placeholder')}
                        onChange={(html, text) =>
                          setReplyDraftByMessageId((prev) => ({
                            ...prev,
                            [message.id]: { html, text },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    disabled={sendingReplyFor === message.id}
                    onClick={() => void handleSendReply(message.id)}
                  >
                    {sendingReplyFor === message.id ? t('messages_reply_sending') : t('messages_reply_send')}
                  </Button>

                  {replies.length > 0 && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {t('messages_replies_heading')}
                      </h3>
                      <ul className="space-y-2">
                        {replies.map((reply) => (
                          <li key={reply.id} className="rounded-md border border-border bg-background p-3">
                            {reply.bodyHtml ? (
                              <div
                                className="prose prose-invert max-w-none break-words text-sm"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(reply.bodyHtml) }}
                              />
                            ) : (
                              <p className="whitespace-pre-wrap text-sm break-words">{reply.body}</p>
                            )}
                            <p className="mt-2 text-xs text-muted-foreground">{new Date(reply.sentAt).toLocaleString()}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </motion.article>
          )
        })}
        {messages.length === 0 && (
          <div className="p-4">
            <PortalEmptyState
              icon={EnvelopeSimple}
              heading={t('messages_no_messages')}
              description={t('messages_no_messages_desc')}
            />
          </div>
        )}
      </div>
    </div>
  )
}
