'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { LabelMessage } from '@/types'
import type { Dictionary } from '@/i18n/types'
import { markPortalMessageRead } from '../_actions/messages'

interface MessagesInboxProps {
  dict: Dictionary['portal']
  initialMessages: LabelMessage[]
}

export function MessagesInbox({ dict, initialMessages }: MessagesInboxProps) {
  const [messages, setMessages] = useState(initialMessages)
  const [loadingId, setLoadingId] = useState<string | null>(null)

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

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{dict.messages_heading}</h1>
      <div className="rounded-lg border border-border divide-y divide-border">
        {messages.map((message) => (
          <article key={message.id} className="p-4 space-y-2">
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
            <p className="text-sm whitespace-pre-wrap">{message.body}</p>
          </article>
        ))}
        {messages.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">No messages yet.</div>
        )}
      </div>
    </div>
  )
}
