'use client'

/**
 * src/components/portal/PortalMailbox.tsx
 *
 * Full mailbox UI for artist-to-artist and artist-to-label messaging.
 *
 * Layout:
 *  - Left panel: FolderTree (Inbox, Sent, Starred, Trash, custom folders) + "Compose" button
 *  - Middle panel: Message list
 *  - Right panel: Message detail + reply with full TipTap editor
 *
 * This mirrors the admin MessagesManager, scoped to the active artist's portal.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { getPortalAuthHeaders } from '@/lib/portal/portalFetchAuth'
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js'
import {
  PaperPlaneTilt,
  Star,
  StarFour,
  Trash,
  ArrowCounterClockwise,
  MagnifyingGlass,
  Spinner,
} from '@phosphor-icons/react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { FolderTree, type FolderSelection } from '@/components/messaging/FolderTree'
import { RichTextEditor } from '@/components/messaging/RichTextEditor'
import { PortalEmptyState } from '@/components/portal/PortalEmptyState'
import { useUnreadMessages } from '@/contexts/PortalNotificationProvider'
import { sendArtistReply } from '@/lib/api/artistReplies'
import { markMessageRead } from '@/lib/api/labelMessages'
import type { ArtistReply, LabelMessage, PortalMessage, PortalMessageFolder, Artist } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PortalMailboxProps {
  artistId: string
  artists: Artist[]
  initialMessages?: PortalMessage[]
  initialFolders?: PortalMessageFolder[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  if (diffHours < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffHours < 168) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString()
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type MailboxSelection =
  | { kind: 'portal'; id: string }
  | { kind: 'label'; id: string }
  | null

export function PortalMailbox({ artistId, artists: _artists, initialMessages = [], initialFolders = [] }: PortalMailboxProps) {
  const t = useTranslations('portal')
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { setUnreadCount } = useUnreadMessages()

  // Folder + message state
  const [selectedFolder, setSelectedFolder] = useState<FolderSelection>('inbox')
  const [folders, setFolders] = useState<PortalMessageFolder[]>(initialFolders)
  const [messages, setMessages] = useState<PortalMessage[]>(initialMessages)
  const [labelMessages, setLabelMessages] = useState<LabelMessage[]>([])
  const [labelReplies, setLabelReplies] = useState<Record<string, ArtistReply[]>>({})
  const [selection, setSelection] = useState<MailboxSelection>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Reply state
  const [replyHtml, setReplyHtml] = useState('')
  const [replyText, setReplyText] = useState('')
  const [isSendingReply, setIsSendingReply] = useState(false)

  // Unread count per folder
  const unreadCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {}
    counts['inbox'] =
      messages.filter((m) => m.toArtistId === artistId && !m.readAt && !m.deletedAt).length +
      labelMessages.filter((m) => !m.read && !m.deletedAt).length
    return counts
  }, [messages, labelMessages, artistId])

  const selectedMessage = useMemo(
    () => (selection?.kind === 'portal' ? messages.find((m) => m.id === selection.id) ?? null : null),
    [messages, selection],
  )

  const selectedLabelMessage = useMemo(
    () => (selection?.kind === 'label' ? labelMessages.find((m) => m.id === selection.id) ?? null : null),
    [labelMessages, selection],
  )

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadMessages = useCallback(async (folder: FolderSelection) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ artistId, folder: String(folder) })
      const res = await fetch(`/api/portal/messages/inbox?${params.toString()}`, {
        headers: await getPortalAuthHeaders(),
      })
      if (!res.ok) throw new Error('Failed to load messages')
      const data = (await res.json()) as {
        messages: PortalMessage[]
        labelMessages?: LabelMessage[]
        labelReplies?: Record<string, ArtistReply[]>
      }
      setMessages(data.messages)
      if (folder === 'inbox') {
        setLabelMessages(data.labelMessages ?? [])
        setLabelReplies(data.labelReplies ?? {})
      } else {
        setLabelMessages([])
        setLabelReplies({})
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('messages_load_failed'))
    } finally {
      setIsLoading(false)
    }
  }, [artistId, t])

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/messages/folders?artistId=${artistId}`, {
        headers: await getPortalAuthHeaders(),
      })
      if (!res.ok) return
      const data = (await res.json()) as { folders: PortalMessageFolder[] }
      setFolders(data.folders)
    } catch {
      // non-fatal
    }
  }, [artistId])

  useEffect(() => {
    void loadMessages(selectedFolder)
  }, [loadMessages, selectedFolder])

  useEffect(() => {
    void loadFolders()
  }, [loadFolders])

  // Realtime subscriptions for incoming portal_messages and label_messages
  useEffect(() => {
    let isMounted = true

    const portalChannel = supabase
      .channel(`portal_messages:${artistId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'portal_messages', filter: `to_artist_id=eq.${artistId}` },
        (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
          if (!isMounted) return
          const row = payload.new
          const msg: PortalMessage = {
            id: row['id'] as string,
            fromArtistId: row['from_artist_id'] as string,
            toArtistId: row['to_artist_id'] as string | null,
            toLabel: row['to_label'] as boolean,
            subject: row['subject'] as string,
            body: row['body'] as string,
            bodyHtml: row['body_html'] as string | null,
            sentAt: row['sent_at'] as string,
            readAt: row['read_at'] as string | null,
            starred: row['starred'] as boolean,
            deletedAt: row['deleted_at'] as string | null,
            folderId: row['folder_id'] as string | null,
            hasAttachments: row['has_attachments'] as boolean,
          }
          if (selectedFolder === 'inbox') {
            setMessages((prev) => [msg, ...prev])
          }
          setUnreadCount((count) => count + 1)
          toast('New message received', { description: msg.subject })
        },
      )
      .subscribe()

    const labelChannel = supabase
      .channel(`portal-label-messages:${artistId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'label_messages', filter: `artist_id=eq.${artistId}` },
        (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
          if (!isMounted) return
          const row = payload.new
          const msg: LabelMessage = {
            id: row['id'] as string,
            artistId: row['artist_id'] as string,
            subject: row['subject'] as string,
            body: row['body'] as string,
            bodyHtml: row['body_html'] as string | null,
            read: row['read'] as boolean,
            readAt: row['read_at'] as string | null,
            starred: row['starred'] as boolean,
            deletedAt: row['deleted_at'] as string | null,
            sentAt: row['sent_at'] as string,
          }
          if (selectedFolder === 'inbox') {
            setLabelMessages((prev) => [msg, ...prev.filter((item) => item.id !== msg.id)])
          }
          setUnreadCount((count) => count + 1)
          toast('New message from label', { description: msg.subject })
        },
      )
      .subscribe()

    return () => {
      isMounted = false
      void supabase.removeChannel(portalChannel)
      void supabase.removeChannel(labelChannel)
    }
  }, [supabase, artistId, selectedFolder, setUnreadCount])

  // ---------------------------------------------------------------------------
  // Message actions
  // ---------------------------------------------------------------------------

  const markRead = useCallback(async (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, readAt: m.readAt ?? new Date().toISOString() } : m,
      ),
    )
    setUnreadCount((count) => Math.max(0, count - 1))
    try {
      await fetch(`/api/portal/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(await getPortalAuthHeaders()),
        },
        body: JSON.stringify({ markRead: true }),
      })
    } catch {
      // non-fatal
    }
  }, [setUnreadCount])

  const toggleStar = useCallback(async (messageId: string, starred: boolean) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, starred } : m)),
    )
    try {
      await fetch(`/api/portal/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(await getPortalAuthHeaders()),
        },
        body: JSON.stringify({ starred }),
      })
    } catch {
      // non-fatal
    }
  }, [])

  const markLabelRead = useCallback(async (messageId: string) => {
    setLabelMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, read: true, readAt: new Date().toISOString() } : m)),
    )
    setUnreadCount((count) => Math.max(0, count - 1))
    try {
      await markMessageRead(supabase, messageId)
    } catch {
      // non-fatal
    }
  }, [setUnreadCount, supabase])

  const softDelete = useCallback(async (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    if (selection?.kind === 'portal' && selection.id === messageId) setSelection(null)
    try {
      await fetch(`/api/portal/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(await getPortalAuthHeaders()),
        },
        body: JSON.stringify({ deleted: true }),
      })
      toast.success(t('messages_moved_trash'))
    } catch {
      toast.error(t('messages_delete_failed'))
    }
  }, [selection, t])

  const restore = useCallback(async (messageId: string) => {
    try {
      await fetch(`/api/portal/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(await getPortalAuthHeaders()),
        },
        body: JSON.stringify({ deleted: false }),
      })
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
      toast.success(t('messages_restored'))
    } catch {
      toast.error(t('messages_restore_failed'))
    }
  }, [t])

  // ---------------------------------------------------------------------------
  // Folder management
  // ---------------------------------------------------------------------------

  const handleCreateFolder = useCallback(async (name: string) => {
    const res = await fetch('/api/portal/messages/folders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getPortalAuthHeaders()),
      },
      body: JSON.stringify({ artistId, name }),
    })
    if (!res.ok) throw new Error('Failed to create folder')
    await loadFolders()
  }, [artistId, loadFolders])

  const handleDeleteFolder = useCallback(async (folderId: string) => {
    const res = await fetch('/api/portal/messages/folders', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(await getPortalAuthHeaders()),
      },
      body: JSON.stringify({ folderId, artistId }),
    })
    if (!res.ok) throw new Error('Failed to delete folder')
    await loadFolders()
    if (selectedFolder === folderId) setSelectedFolder('inbox')
  }, [artistId, loadFolders, selectedFolder])

  const handleRenameFolder = useCallback(async (folderId: string, newName: string) => {
    const res = await fetch('/api/portal/messages/folders', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(await getPortalAuthHeaders()),
      },
      body: JSON.stringify({ folderId, artistId, name: newName }),
    })
    if (!res.ok) throw new Error('Failed to rename folder')
    await loadFolders()
  }, [artistId, loadFolders])

  // ---------------------------------------------------------------------------
  // Filtered messages
  // ---------------------------------------------------------------------------

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages
    const q = searchQuery.toLowerCase()
    return messages.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q),
    )
  }, [messages, searchQuery])

  const filteredLabelMessages = useMemo(() => {
    if (selectedFolder !== 'inbox') return []
    if (!searchQuery.trim()) return labelMessages
    const q = searchQuery.toLowerCase()
    return labelMessages.filter(
      (m) => m.subject.toLowerCase().includes(q) || m.body.toLowerCase().includes(q),
    )
  }, [labelMessages, searchQuery, selectedFolder])

  const inboxItems = useMemo(() => {
    if (selectedFolder !== 'inbox') return []
    const portalItems = filteredMessages.map((message) => ({
      kind: 'portal' as const,
      id: message.id,
      sentAt: message.sentAt,
      message,
    }))
    const labelItems = filteredLabelMessages.map((message) => ({
      kind: 'label' as const,
      id: message.id,
      sentAt: message.sentAt,
      message,
    }))
    return [...portalItems, ...labelItems].sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
    )
  }, [filteredMessages, filteredLabelMessages, selectedFolder])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-lg border border-border">
      {/* Left panel — folder tree */}
      <div className="w-52 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="p-3">
          <Button size="sm" className="w-full gap-2" asChild>
            <Link href={`/portal/messages/compose?artistId=${encodeURIComponent(artistId)}`}>
              <PaperPlaneTilt size={14} aria-hidden="true" />
              {t('messages_compose')}
            </Link>
          </Button>
        </div>
        <Separator />
        <div className="flex-1 overflow-y-auto overscroll-contain p-2" data-lenis-prevent>
          <FolderTree
            selected={selectedFolder}
            onSelect={setSelectedFolder}
            customFolders={folders.map((f) => ({ id: f.id, name: f.name, icon: f.icon ?? undefined, color: f.color ?? undefined, createdAt: f.createdAt }))}
            unreadCounts={unreadCounts}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            onRenameFolder={handleRenameFolder}
          />
        </div>
      </div>

      {/* Middle panel — message list */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col bg-background">
        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <MagnifyingGlass
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto overscroll-contain" data-lenis-prevent>
          {isLoading ? (
            <div className="flex items-center justify-center h-24">
              <Spinner size={20} className="animate-spin text-muted-foreground" aria-label="Loading" />
            </div>
          ) : (selectedFolder === 'inbox' ? inboxItems.length === 0 : filteredMessages.length === 0) ? (
            <PortalEmptyState
              icon={PaperPlaneTilt}
              heading="No messages"
              description={searchQuery ? 'No messages match your search.' : 'This folder is empty.'}
            />
          ) : (
            <ul>
              {(selectedFolder === 'inbox' ? inboxItems : filteredMessages.map((message) => ({ kind: 'portal' as const, id: message.id, sentAt: message.sentAt, message }))).map((item) => {
                if (item.kind === 'label') {
                  const msg = item.message
                  const isUnread = !msg.read
                  const isSelected = selection?.kind === 'label' && selection.id === msg.id
                  return (
                    <li key={`label-${msg.id}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelection({ kind: 'label', id: msg.id })
                          if (isUnread) void markLabelRead(msg.id)
                        }}
                        aria-label={`${isUnread ? 'Unread: ' : ''}${msg.subject}`}
                        className={[
                          'w-full min-h-[44px] text-left px-3 py-3 border-b border-border transition-colors',
                          isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted',
                          isUnread ? 'font-semibold' : '',
                        ].join(' ')}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground truncate">{t('messages_label_sender')}</span>
                          <span className="text-xs text-muted-foreground shrink-0 ml-1">{formatDate(msg.sentAt)}</span>
                        </div>
                        <p className="text-sm truncate">{msg.subject}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.body.slice(0, 80)}</p>
                        {isUnread && <span className="h-2 w-2 rounded-full bg-primary inline-block mt-1" aria-label="Unread" />}
                      </button>
                    </li>
                  )
                }

                const msg = item.message
                const isUnread = !msg.readAt && msg.toArtistId === artistId
                const isSelected = selection?.kind === 'portal' && selection.id === msg.id
                return (
                  <li key={msg.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelection({ kind: 'portal', id: msg.id })
                        if (isUnread) void markRead(msg.id)
                      }}
                      aria-label={`${isUnread ? 'Unread: ' : ''}${msg.subject}`}
                      className={[
                        'w-full min-h-[44px] text-left px-3 py-3 border-b border-border transition-colors',
                        isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted',
                        isUnread ? 'font-semibold' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground truncate">
                          {msg.toLabel ? 'Label' : msg.toArtistId === artistId ? msg.fromArtistName ?? 'Artist' : msg.toArtistName ?? 'Artist'}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0 ml-1">{formatDate(msg.sentAt)}</span>
                      </div>
                      <p className="text-sm truncate">{msg.subject}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.body.slice(0, 80)}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {isUnread && <span className="h-2 w-2 rounded-full bg-primary inline-block" aria-label="Unread" />}
                        {msg.starred && <StarFour size={11} className="text-amber-400" aria-hidden="true" />}
                        {msg.hasAttachments && <span className="text-xs text-muted-foreground">📎</span>}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Right panel — message detail */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {selectedLabelMessage ? (
          <>
            <div className="p-4 border-b border-border">
              <h2 className="text-base font-semibold truncate">{selectedLabelMessage.subject}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('messages_from_label')} · {new Date(selectedLabelMessage.sentAt).toLocaleString()}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4" data-lenis-prevent>
              {selectedLabelMessage.bodyHtml ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedLabelMessage.bodyHtml) }}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{selectedLabelMessage.body}</p>
              )}
              {(labelReplies[selectedLabelMessage.id] ?? []).map((reply) => (
                <div key={reply.id} className="rounded-lg border border-border bg-card/60 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">{formatDate(reply.sentAt)}</p>
                  {reply.bodyHtml ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(reply.bodyHtml) }}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-border p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reply to Label</p>
              <RichTextEditor
                value={replyHtml}
                onChange={(html, text) => {
                  setReplyHtml(html)
                  setReplyText(text)
                }}
                placeholder="Write a reply…"
                minHeight={80}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!replyText.trim() || isSendingReply}
                  onClick={() => {
                    void (async () => {
                      setIsSendingReply(true)
                      try {
                        const reply = await sendArtistReply(
                          supabase,
                          selectedLabelMessage.id,
                          artistId,
                          replyText,
                          replyHtml || undefined,
                        )
                        const replies = labelReplies[selectedLabelMessage.id] ?? []
                        setLabelReplies({
                          ...labelReplies,
                          [selectedLabelMessage.id]: [...replies, reply],
                        })
                        setReplyHtml('')
                        setReplyText('')
                        toast.success(t('messages_reply_sent'))
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : t('messages_reply_failed'))
                      } finally {
                        setIsSendingReply(false)
                      }
                    })()
                  }}
                >
                  {isSendingReply ? t('messages_compose_sending') : t('messages_send_reply')}
                </Button>
              </div>
            </div>
          </>
        ) : !selectedMessage ? (
          <div className="flex-1 flex items-center justify-center">
            <PortalEmptyState
              icon={PaperPlaneTilt}
              heading="Select a message"
              description="Choose a message from the list to read it."
            />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold truncate">{selectedMessage.subject}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(selectedMessage.sentAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => void toggleStar(selectedMessage.id, !selectedMessage.starred)}
                    aria-label={selectedMessage.starred ? 'Unstar' : 'Star'}
                  >
                    {selectedMessage.starred ? (
                      <StarFour size={16} className="text-amber-400" aria-hidden="true" />
                    ) : (
                      <Star size={16} aria-hidden="true" />
                    )}
                  </Button>
                  {selectedFolder === 'trash' ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void restore(selectedMessage.id)}
                      aria-label="Restore message"
                    >
                      <ArrowCounterClockwise size={16} aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void softDelete(selectedMessage.id)}
                      aria-label="Delete message"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash size={16} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4" data-lenis-prevent>
              {selectedMessage.bodyHtml ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedMessage.bodyHtml) }}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{selectedMessage.body}</p>
              )}
            </div>

            {/* Reply box — only for received messages */}
            {selectedMessage.toArtistId === artistId && (
              <div className="border-t border-border p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reply</p>
                <RichTextEditor
                  value={replyHtml}
                  onChange={(html, text) => {
                    setReplyHtml(html)
                    setReplyText(text)
                  }}
                  placeholder="Write a reply…"
                  minHeight={80}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!replyText.trim()) return
                      // Send as a new message back to the original sender
                      void (async () => {
                        setIsSendingReply(true)
                        try {
                          const res = await fetch('/api/portal/messages/send', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(await getPortalAuthHeaders()),
                            },
                            body: JSON.stringify({
                              fromArtistId: artistId,
                              toArtistId: selectedMessage.fromArtistId,
                              toLabel: false,
                              subject: `Re: ${selectedMessage.subject}`,
                              body: replyText,
                              bodyHtml: replyHtml || null,
                            }),
                          })
                          if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? t('messages_reply_failed'))
                          toast.success(t('messages_reply_sent'))
                          setReplyHtml('')
                          setReplyText('')
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : t('messages_reply_failed'))
                        } finally {
                          setIsSendingReply(false)
                        }
                      })()
                    }}
                    disabled={!replyText.trim() || isSendingReply}
                    className="gap-2"
                  >
                    <PaperPlaneTilt size={14} aria-hidden="true" />
                    {isSendingReply ? t('messages_compose_sending') : t('messages_send_reply')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
