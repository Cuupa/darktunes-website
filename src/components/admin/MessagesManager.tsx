'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getArtists } from '@/lib/api/artists'
import { getRepliesForMessage } from '@/lib/api/artistReplies'
import {
  getAllLabelMessages,
  getMessageTemplates,
  searchLabelMessages,
  sendMessage,
  softDeleteMessage,
  starMessage,
  markMessageRead,
} from '@/lib/api/labelMessages'
import type { ArtistReply, LabelMessage, MessageTemplate } from '@/types'
import type { Database } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageComposer } from '@/components/messaging/MessageComposer'
import { MessageSearch } from '@/components/messaging/MessageSearch'
import { ThreadView } from '@/components/messaging/ThreadView'
import { useAuthContext } from '@/contexts/AuthContext'

interface SearchState {
  query: string
  artistId: string | null
  unreadOnly: boolean
}

type MessageRow = Database['public']['Tables']['label_messages']['Row']
type ReplyRow = Database['public']['Tables']['artist_replies']['Row']

const DEFAULT_SEARCH_STATE: SearchState = { query: '', artistId: null, unreadOnly: false }

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

function rowToReply(row: ReplyRow): ArtistReply {
  return {
    id: row.id,
    messageId: row.message_id,
    artistId: row.artist_id,
    body: row.body,
    bodyHtml: row.body_html,
    deletedAt: row.deleted_at,
    sentAt: row.sent_at,
  }
}

async function loadReplies(
  supabase: ReturnType<typeof createBrowserSupabaseClient>,
  messages: LabelMessage[],
): Promise<Record<string, ArtistReply[]>> {
  const entries = await Promise.allSettled(
    messages.map(async (message) => [message.id, await getRepliesForMessage(supabase, message.id)] as const),
  )

  return entries.reduce<Record<string, ArtistReply[]>>((accumulator, result) => {
    if (result.status === 'fulfilled') {
      accumulator[result.value[0]] = result.value[1]
    }
    return accumulator
  }, {})
}

export function MessagesManager() {
  const { loading: authLoading, session } = useAuthContext()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const searchStateRef = useRef<SearchState>(DEFAULT_SEARCH_STATE)
  const [artists, setArtists] = useState<Array<{ id: string; name: string }>>([])
  const [messages, setMessages] = useState<LabelMessage[]>([])
  const [repliesByMessageId, setRepliesByMessageId] = useState<Record<string, ArtistReply[]>>({})
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSending, setIsSending] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isLoadingArtists, setIsLoadingArtists] = useState(true)
  const [artistLoadError, setArtistLoadError] = useState<string | null>(null)

  const refreshMessages = useCallback(
    async (state: SearchState) => {
      const nextMessages = state.query.trim() || state.artistId || state.unreadOnly
        ? await searchLabelMessages(supabase, state.query, {
            artistId: state.artistId ?? undefined,
            unreadOnly: state.unreadOnly,
          })
        : await getAllLabelMessages(supabase)

      setMessages(nextMessages)
      setRepliesByMessageId(await loadReplies(supabase, nextMessages))
    },
    [supabase],
  )

  const load = useCallback(async () => {
    if (authLoading) return
    if (!session?.access_token || !session.refresh_token) {
      setArtists([])
      setIsLoadingArtists(false)
      setArtistLoadError('Please sign in again to load artists.')
      return
    }

    setIsLoadingArtists(true)
    setArtistLoadError(null)

    try {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
      if (sessionError) throw new Error(sessionError.message)

      const [artistResult, templateResult] = await Promise.allSettled([getArtists(supabase), getMessageTemplates(supabase)])

      if (artistResult.status === 'fulfilled') {
        setArtists(artistResult.value.map((artist) => ({ id: artist.id, name: artist.name })))
      } else {
        setArtists([])
        setArtistLoadError(artistResult.reason instanceof Error ? artistResult.reason.message : 'Failed to load artists')
      }

      if (templateResult.status === 'fulfilled') {
        setTemplates(templateResult.value)
      } else {
        setTemplates([])
        toast.error(templateResult.reason instanceof Error ? templateResult.reason.message : 'Failed to load message templates')
      }

      await refreshMessages(searchStateRef.current)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load messages'
      setArtists([])
      setArtistLoadError(message)
      toast.error(message)
    } finally {
      setIsLoadingArtists(false)
    }
  }, [authLoading, refreshMessages, session?.access_token, session?.refresh_token, supabase])

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, load])

  useEffect(() => {
    const messageChannel = supabase
      .channel('admin-label-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'label_messages' },
        (payload: RealtimePostgresInsertPayload<MessageRow>) => {
          const nextMessage = rowToMessage(payload.new)
          const state = searchStateRef.current
          if (state.query.trim() || state.artistId || state.unreadOnly) {
            void refreshMessages(state)
            return
          }
          setMessages((current) => [nextMessage, ...current.filter((message) => message.id !== nextMessage.id)])
        },
      )
      .subscribe()

    const replyChannel = supabase
      .channel('admin-artist-replies')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'artist_replies' },
        (payload: RealtimePostgresInsertPayload<ReplyRow>) => {
          const nextReply = rowToReply(payload.new)
          setRepliesByMessageId((current) => ({
            ...current,
            [nextReply.messageId]: [...(current[nextReply.messageId] ?? []), nextReply],
          }))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(messageChannel)
      void supabase.removeChannel(replyChannel)
    }
  }, [refreshMessages, supabase])

  const unreadCount = useMemo(() => messages.filter((message) => !message.read && !message.deletedAt).length, [messages])

  const handleSearch = useCallback(
    (query: string, artistId: string | null, unreadOnly: boolean) => {
      const nextState = { query, artistId, unreadOnly }
      searchStateRef.current = nextState
      void refreshMessages(nextState)
    },
    [refreshMessages],
  )

  const handleSend = useCallback(
    async (artistIds: string[], subject: string, html: string, text: string) => {
      setIsSending(true)
      try {
        await Promise.all(artistIds.map((artistId) => sendMessage(supabase, artistId, subject, text, html)))
        await refreshMessages(searchStateRef.current)
        toast.success(`Message sent to ${artistIds.length} artist${artistIds.length === 1 ? '' : 's'}`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to send message')
        throw error
      } finally {
        setIsSending(false)
      }
    },
    [refreshMessages, supabase],
  )

  const handleStar = useCallback(
    async (id: string, starred: boolean) => {
      try {
        const updated = await starMessage(supabase, id, starred)
        setMessages((current) => current.map((message) => (message.id === id ? updated : message)))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update star')
      }
    },
    [supabase],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await softDeleteMessage(supabase, id)
        setSelectedIds((current) => {
          const next = new Set(current)
          next.delete(id)
          return next
        })
        await refreshMessages(searchStateRef.current)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to delete message')
      }
    },
    [refreshMessages, supabase],
  )

  const handleExport = useCallback(
    (id: string) => {
      const message = messages.find((item) => item.id === id)
      if (!message) return
      const payload = {
        message,
        replies: repliesByMessageId[id] ?? [],
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `message-${id}.json`
      link.click()
      URL.revokeObjectURL(url)
    },
    [messages, repliesByMessageId],
  )

  const handleMarkRead = useCallback(
    async (id: string) => {
      try {
        const updated = await markMessageRead(supabase, id)
        setMessages((current) => current.map((message) => (message.id === id ? updated : message)))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to mark message as read')
      }
    },
    [supabase],
  )

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    setIsBulkDeleting(true)
    try {
      await Promise.all(Array.from(selectedIds).map((id) => softDeleteMessage(supabase, id)))
      setSelectedIds(new Set())
      await refreshMessages(searchStateRef.current)
      toast.success('Selected messages deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete selected messages')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold">Artist Messages</h2>
        <Badge>{unreadCount} unread</Badge>
      </div>

      <MessageComposer
        artists={artists}
        templates={templates}
        isSending={isSending}
        isArtistsLoading={isLoadingArtists}
        artistLoadError={artistLoadError}
        onSend={handleSend}
      />

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-4">
          <p className="text-sm text-muted-foreground">{selectedIds.size} message{selectedIds.size === 1 ? '' : 's'} selected</p>
          <Button type="button" variant="destructive" disabled={isBulkDeleting} onClick={() => void handleDeleteSelected()}>
            {isBulkDeleting ? 'Deleting…' : `Delete selected (${selectedIds.size})`}
          </Button>
        </div>
      )}

      <MessageSearch artists={artists} onSearch={handleSearch} />

      <ThreadView
        messages={messages}
        repliesByMessageId={repliesByMessageId}
        artists={artists}
        onStar={handleStar}
        onDelete={handleDelete}
        onExport={handleExport}
        onMarkRead={handleMarkRead}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelected}
      />
    </div>
  )
}
