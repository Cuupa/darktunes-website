'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CaretDown, ChatCircleText, EnvelopeSimple } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { PortalEmptyState } from '@/components/portal/PortalEmptyState'
import type { ArtistReply, LabelMessage } from '@/types'
import type { Dictionary } from '@/i18n/types'
import { markPortalMessageRead } from '../_actions/messages'
import { sendPortalReply } from '../_actions/reply'
import { REPLY_MAX_LENGTH, REPLY_MIN_LENGTH } from '../_constants'

interface MessagesInboxProps {
  dict: Dictionary['portal']
  initialMessages: LabelMessage[]
  initialRepliesByMessageId: Record<string, ArtistReply[]>
}

export function MessagesInbox({ dict, initialMessages, initialRepliesByMessageId }: MessagesInboxProps) {
  const [messages, setMessages] = useState(initialMessages)
  const [repliesByMessageId, setRepliesByMessageId] = useState(initialRepliesByMessageId)
  const [replyDraftByMessageId, setReplyDraftByMessageId] = useState<Record<string, string>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [sendingReplyFor, setSendingReplyFor] = useState<string | null>(null)

  const handleRead = async (id: string) => {
    setLoadingId(id)
    try {
      await markPortalMessageRead(id)
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark message as read')
    } finally {
      setLoadingId(null)
    }
  }

  const handleSendReply = async (messageId: string) => {
    const body = (replyDraftByMessageId[messageId] ?? '').trim()
    if (body.length < REPLY_MIN_LENGTH) {
      toast.error(dict.messages_reply_error)
      return
    }
    if (body.length > REPLY_MAX_LENGTH) {
      toast.error(dict.messages_reply_error)
      return
    }

    setSendingReplyFor(messageId)
    try {
      const reply = await sendPortalReply(messageId, body)
      setRepliesByMessageId((prev) => ({
        ...prev,
        [messageId]: [...(prev[messageId] ?? []), reply],
      }))
      setReplyDraftByMessageId((prev) => ({ ...prev, [messageId]: '' }))
      toast.success(dict.messages_reply_sent)
    } catch {
      toast.error(dict.messages_reply_error)
    } finally {
      setSendingReplyFor(null)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{dict.messages_heading}</h1>
      <div className="rounded-lg border border-border divide-y divide-border">
        {messages.map((message) => {
          const replies = repliesByMessageId[message.id] ?? []
          return (
            <article key={message.id} className="space-y-4 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{message.subject}</h2>
                {!message.read && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loadingId === message.id}
                    onClick={() => void handleRead(message.id)}
                  >
                    Mark as read
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{new Date(message.sentAt).toLocaleString()}</p>
              <p className="whitespace-pre-wrap text-sm">{message.body}</p>

              <Collapsible className="rounded-md border border-border bg-card/40">
                <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium">
                  <span className="inline-flex items-center gap-2">
                    <ChatCircleText size={16} aria-hidden="true" />
                    {dict.messages_reply}
                  </span>
                  <CaretDown size={16} className="text-muted-foreground" aria-hidden="true" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 border-t border-border p-3">
                  <label className="sr-only" htmlFor={`reply-${message.id}`}>{dict.messages_reply}</label>
                  <Textarea
                    id={`reply-${message.id}`}
                    value={replyDraftByMessageId[message.id] ?? ''}
                    onChange={(e) => setReplyDraftByMessageId((prev) => ({ ...prev, [message.id]: e.target.value }))}
                    placeholder={dict.messages_reply_placeholder}
                    maxLength={REPLY_MAX_LENGTH}
                  />
                  <Button
                    type="button"
                    disabled={sendingReplyFor === message.id}
                    onClick={() => void handleSendReply(message.id)}
                  >
                    {sendingReplyFor === message.id ? dict.messages_reply_sending : dict.messages_reply_send}
                  </Button>

                  {replies.length > 0 && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {dict.messages_replies_heading}
                      </h3>
                      <ul className="space-y-2">
                        {replies.map((reply) => (
                          <li key={reply.id} className="rounded-md border border-border bg-background p-3">
                            <p className="whitespace-pre-wrap text-sm">{reply.body}</p>
                            <p className="mt-2 text-xs text-muted-foreground">{new Date(reply.sentAt).toLocaleString()}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </article>
          )
        })}
        {messages.length === 0 && (
          <div className="p-4">
            <PortalEmptyState
              icon={EnvelopeSimple}
              heading="No messages yet."
              description="You'll see new messages from the label here."
            />
          </div>
        )}
      </div>
    </div>
  )
}
