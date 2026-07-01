'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PencilSimple,
  ArrowBendUpLeft,
  ArrowBendUpRight,
  Star,
  StarFour,
  Trash,
  Download,
  Paperclip,
} from '@phosphor-icons/react'
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
import {
  getIncomingToLabelMessages,
  markPortalMessageRead,
  softDeletePortalMessage,
  togglePortalMessageStar,
} from '@/lib/api/portalMessages'
import {
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  moveMessageToFolder,
} from '@/lib/api/messageFolders'
import { getRules, createRule, updateRule, deleteRule } from '@/lib/api/messageRules'
import { getAttachmentsForMessage } from '@/lib/api/messageAttachments'
import type {
  ArtistReply,
  LabelMessage,
  MessageFolder,
  MessageRule,
  MessageAttachment,
  MessageTemplate,
  PortalMessage,
} from '@/types'
import type { Database } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { MessageComposer } from '@/components/messaging/MessageComposer'
import { MessageSearch } from '@/components/messaging/MessageSearch'
import { FolderTree, type FolderSelection } from '@/components/messaging/FolderTree'
import { MessageRulesManager } from '@/components/messaging/MessageRulesManager'
import { ExternalEmailComposer } from '@/components/messaging/ExternalEmailComposer'
import { AttachmentViewer } from '@/components/messaging/AttachmentViewer'
import { useAuthContext } from '@/contexts/AuthContext'
import { sanitizeHtml as sanitizeHtmlSafe } from '@/lib/sanitizeHtml'

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchState {
  query: string
  artistId: string | null
  unreadOnly: boolean
}

type MessageRow = Database['public']['Tables']['label_messages']['Row']
type ReplyRow = Database['public']['Tables']['artist_replies']['Row']
type PortalMessageRow = Database['public']['Tables']['portal_messages']['Row']

function rowToPortalMessage(row: PortalMessageRow): PortalMessage {
  return {
    id: row.id,
    fromArtistId: row.from_artist_id,
    toArtistId: row.to_artist_id,
    toLabel: row.to_label,
    subject: row.subject,
    body: row.body,
    bodyHtml: row.body_html,
    sentAt: row.sent_at,
    readAt: row.read_at,
    starred: row.starred,
    deletedAt: row.deleted_at,
    folderId: row.folder_id,
    hasAttachments: row.has_attachments,
  }
}

const DEFAULT_SEARCH: SearchState = { query: '', artistId: null, unreadOnly: false }

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    folderId: row.folder_id,
    senderEmail: row.sender_email,
    isExternal: row.is_external,
    forwardedFrom: row.forwarded_from,
    hasAttachments: row.has_attachments,
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

function sanitizeHtml(html: string): string {
  return sanitizeHtmlSafe(html)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

async function loadReplies(
  supabase: ReturnType<typeof createBrowserSupabaseClient>,
  messages: LabelMessage[],
): Promise<Record<string, ArtistReply[]>> {
  const entries = await Promise.allSettled(
    messages.map(async (m) => [m.id, await getRepliesForMessage(supabase, m.id)] as const),
  )
  return entries.reduce<Record<string, ArtistReply[]>>((acc, r) => {
    if (r.status === 'fulfilled') acc[r.value[0]] = r.value[1]
    return acc
  }, {})
}

// ── Main Component ────────────────────────────────────────────────────────────

export function MessagesManager() {
  const { loading: authLoading, session } = useAuthContext()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const searchStateRef = useRef<SearchState>(DEFAULT_SEARCH)

  // Core data
  const [artists, setArtists] = useState<Array<{ id: string; name: string }>>([])
  const [messages, setMessages] = useState<LabelMessage[]>([])
  const [fromArtistMessages, setFromArtistMessages] = useState<PortalMessage[]>([])
  const [repliesByMessageId, setRepliesByMessageId] = useState<Record<string, ArtistReply[]>>({})
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [folders, setFolders] = useState<MessageFolder[]>([])
  const [rules, setRules] = useState<MessageRule[]>([])

  // UI state
  const [selectedFolder, setSelectedFolder] = useState<FolderSelection>('inbox')
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<MessageAttachment[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isLoadingArtists, setIsLoadingArtists] = useState(true)
  const [artistLoadError, setArtistLoadError] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // ── Folder-filtered message lists ─────────────────────────────────────────

  const isFromArtistsFolder = selectedFolder === 'from-artists'

  const folderMessages = useMemo(() => {
    if (isFromArtistsFolder) return []
    switch (selectedFolder) {
      case 'inbox':
        return messages.filter((m) => !m.deletedAt && !m.folderId)
      case 'starred':
        return messages.filter((m) => !m.deletedAt && m.starred)
      case 'sent':
        return messages.filter((m) => !m.deletedAt && m.isExternal)
      case 'trash':
        return messages.filter((m) => !!m.deletedAt)
      default:
        return messages.filter((m) => !m.deletedAt && m.folderId === selectedFolder)
    }
  }, [messages, selectedFolder, isFromArtistsFolder])

  const fromArtistFolderMessages = useMemo(() => {
    if (!isFromArtistsFolder) return []
    return fromArtistMessages.filter((m) => !m.deletedAt)
  }, [fromArtistMessages, isFromArtistsFolder])

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return folderMessages
    const q = searchQuery.toLowerCase()
    return folderMessages.filter(
      (m) => m.subject.toLowerCase().includes(q) || m.body.toLowerCase().includes(q),
    )
  }, [folderMessages, searchQuery])

  const filteredFromArtistMessages = useMemo(() => {
    if (!searchQuery.trim()) return fromArtistFolderMessages
    const q = searchQuery.toLowerCase()
    return fromArtistFolderMessages.filter(
      (m) => m.subject.toLowerCase().includes(q) || m.body.toLowerCase().includes(q),
    )
  }, [fromArtistFolderMessages, searchQuery])

  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    counts['inbox'] = messages.filter((m) => !m.deletedAt && !m.folderId && !m.read).length
    counts['from-artists'] = fromArtistMessages.filter((m) => !m.deletedAt && !m.readAt).length
    counts['starred'] = messages.filter((m) => !m.deletedAt && m.starred && !m.read).length
    counts['sent'] = 0
    counts['trash'] = 0
    folders.forEach((f) => {
      counts[f.id] = messages.filter((m) => !m.deletedAt && m.folderId === f.id && !m.read).length
    })
    return counts
  }, [messages, folders, fromArtistMessages])

  // Selected message
  const selectedMessage = useMemo(
    () => messages.find((m) => m.id === selectedMessageId) ?? null,
    [messages, selectedMessageId],
  )

  const selectedFromArtistMessage = useMemo(
    () => fromArtistMessages.find((m) => m.id === selectedMessageId) ?? null,
    [fromArtistMessages, selectedMessageId],
  )

  // ── Data Loading ──────────────────────────────────────────────────────────

  const refreshMessages = useCallback(
    async (state: SearchState) => {
      const next =
        state.query.trim() || state.artistId || state.unreadOnly
          ? await searchLabelMessages(supabase, state.query, {
              artistId: state.artistId ?? undefined,
              unreadOnly: state.unreadOnly,
            })
          : await getAllLabelMessages(supabase)
      setMessages(next)
      setRepliesByMessageId(await loadReplies(supabase, next))
    },
    [supabase],
  )

  const load = useCallback(async () => {
    if (authLoading) return
    if (!session?.access_token || !session.refresh_token) {
      setIsLoadingArtists(false)
      setArtistLoadError('Please sign in again to load artists.')
      return
    }
    setIsLoadingArtists(true)
    setArtistLoadError(null)
    try {
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
      const [artistRes, templateRes, folderRes, ruleRes] = await Promise.allSettled([
        getArtists(supabase),
        getMessageTemplates(supabase),
        getFolders(supabase),
        getRules(supabase),
      ])
      if (artistRes.status === 'fulfilled') {
        setArtists(artistRes.value.map((a) => ({ id: a.id, name: a.name })))
      } else {
        setArtistLoadError(artistRes.reason instanceof Error ? artistRes.reason.message : 'Failed to load artists')
      }
      if (templateRes.status === 'fulfilled') {
        setTemplates(templateRes.value)
      } else {
        toast.error(templateRes.reason instanceof Error ? templateRes.reason.message : 'Failed to load templates')
      }
      if (folderRes.status === 'fulfilled') setFolders(folderRes.value)
      if (ruleRes.status === 'fulfilled') setRules(ruleRes.value)
      const fromArtists = await getIncomingToLabelMessages(supabase)
      setFromArtistMessages(fromArtists)
      await refreshMessages(searchStateRef.current)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load messages'
      setArtistLoadError(msg)
      toast.error(msg)
    } finally {
      setIsLoadingArtists(false)
    }
  }, [authLoading, refreshMessages, session?.access_token, session?.refresh_token, supabase])

  useEffect(() => {
    if (!authLoading) void load()
  }, [authLoading, load])

  // Realtime subscriptions
  useEffect(() => {
    const msgCh = supabase
      .channel('admin-label-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'label_messages' }, (payload: RealtimePostgresInsertPayload<MessageRow>) => {
        const next = rowToMessage(payload.new)
        const state = searchStateRef.current
        if (state.query.trim() || state.artistId || state.unreadOnly) { void refreshMessages(state); return }
        setMessages((cur) => [next, ...cur.filter((m) => m.id !== next.id)])
      })
      .subscribe()
    const replyCh = supabase
      .channel('admin-artist-replies')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'artist_replies' }, (payload: RealtimePostgresInsertPayload<ReplyRow>) => {
        const next = rowToReply(payload.new)
        setRepliesByMessageId((cur) => ({
          ...cur,
          [next.messageId]: [...(cur[next.messageId] ?? []), next],
        }))
      })
      .subscribe()
    const portalCh = supabase
      .channel('admin-portal-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portal_messages', filter: 'to_label=eq.true' }, (payload: RealtimePostgresInsertPayload<PortalMessageRow>) => {
        const next = rowToPortalMessage(payload.new)
        setFromArtistMessages((cur) => [next, ...cur.filter((m) => m.id !== next.id)])
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(msgCh)
      void supabase.removeChannel(replyCh)
      void supabase.removeChannel(portalCh)
    }
  }, [refreshMessages, supabase])

  // Load attachments when a message is selected
  useEffect(() => {
    if (!selectedMessageId) { setAttachments([]); return }
    const msg = messages.find((m) => m.id === selectedMessageId)
    if (!msg?.hasAttachments) { setAttachments([]); return }
    setLoadingAttachments(true)
    getAttachmentsForMessage(supabase, selectedMessageId)
      .then(setAttachments)
      .catch(() => setAttachments([]))
      .finally(() => setLoadingAttachments(false))
  }, [selectedMessageId, messages, supabase])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSearch = useCallback(
    (query: string, artistId: string | null, unreadOnly: boolean) => {
      const next = { query, artistId, unreadOnly }
      searchStateRef.current = next
      void refreshMessages(next)
    },
    [refreshMessages],
  )

  const handleSend = useCallback(
    async (artistIds: string[], subject: string, html: string, text: string) => {
      setIsSending(true)
      try {
        await Promise.all(artistIds.map((id) => sendMessage(supabase, id, subject, text, html)))
        await refreshMessages(searchStateRef.current)
        toast.success(`Message sent to ${artistIds.length} artist${artistIds.length === 1 ? '' : 's'}`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to send message')
        throw e
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
        setMessages((cur) => cur.map((m) => (m.id === id ? updated : m)))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to update star')
      }
    },
    [supabase],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await softDeleteMessage(supabase, id)
        if (selectedMessageId === id) setSelectedMessageId(null)
        await refreshMessages(searchStateRef.current)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to delete message')
      }
    },
    [refreshMessages, supabase, selectedMessageId],
  )

  const handleMarkRead = useCallback(
    async (id: string) => {
      try {
        const updated = await markMessageRead(supabase, id)
        setMessages((cur) => cur.map((m) => (m.id === id ? updated : m)))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to mark as read')
      }
    },
    [supabase],
  )

  const handleMoveToFolder = useCallback(
    async (id: string, folderId: string | null) => {
      try {
        await moveMessageToFolder(supabase, id, folderId)
        setMessages((cur) => cur.map((m) => (m.id === id ? { ...m, folderId } : m)))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to move message')
      }
    },
    [supabase],
  )

  const handleMarkPortalRead = useCallback(
    async (id: string) => {
      try {
        await markPortalMessageRead(supabase, id)
        void supabase
          .from('editor_notifications')
          .update({ read: true })
          .eq('entity_id', id)
          .eq('type', 'artist_portal_message')
        setFromArtistMessages((cur) =>
          cur.map((m) => (m.id === id ? { ...m, readAt: new Date().toISOString() } : m)),
        )
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to mark as read')
      }
    },
    [supabase],
  )

  const handlePortalStar = useCallback(
    async (id: string, starred: boolean) => {
      try {
        await togglePortalMessageStar(supabase, id, starred)
        setFromArtistMessages((cur) => cur.map((m) => (m.id === id ? { ...m, starred } : m)))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to update star')
      }
    },
    [supabase],
  )

  const handlePortalDelete = useCallback(
    async (id: string) => {
      try {
        await softDeletePortalMessage(supabase, id)
        if (selectedMessageId === id) setSelectedMessageId(null)
        setFromArtistMessages((cur) => cur.filter((m) => m.id !== id))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to delete message')
      }
    },
    [selectedMessageId, supabase],
  )

  const handleSelectMessage = useCallback(
    async (id: string) => {
      setSelectedMessageId(id)
      const msg = messages.find((m) => m.id === id)
      if (msg && !msg.read) await handleMarkRead(id)
    },
    [messages, handleMarkRead],
  )

  const handleSelectFromArtistMessage = useCallback(
    async (id: string) => {
      setSelectedMessageId(id)
      const msg = fromArtistMessages.find((m) => m.id === id)
      if (msg && !msg.readAt) await handleMarkPortalRead(id)
    },
    [fromArtistMessages, handleMarkPortalRead],
  )

  const handleExport = useCallback(
    (id: string) => {
      const message = messages.find((m) => m.id === id)
      if (!message) return
      const blob = new Blob([JSON.stringify({ message, replies: repliesByMessageId[id] ?? [] }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `message-${id}.json`
      link.click()
      URL.revokeObjectURL(url)
    },
    [messages, repliesByMessageId],
  )

  // Folder management
  const handleCreateFolder = useCallback(async (name: string) => {
    const folder = await createFolder(supabase, name)
    setFolders((cur) => [...cur, folder])
  }, [supabase])

  const handleDeleteFolder = useCallback(async (id: string) => {
    await deleteFolder(supabase, id)
    setFolders((cur) => cur.filter((f) => f.id !== id))
    if (selectedFolder === id) setSelectedFolder('inbox')
  }, [supabase, selectedFolder])

  const handleRenameFolder = useCallback(async (id: string, name: string) => {
    const updated = await updateFolder(supabase, id, { name })
    setFolders((cur) => cur.map((f) => (f.id === id ? updated : f)))
  }, [supabase])

  // Rule management
  const handleCreateRule = useCallback(async (rule: Omit<MessageRule, 'id' | 'createdAt'>) => {
    const created = await createRule(supabase, rule)
    setRules((cur) => [...cur, created])
  }, [supabase])

  const handleToggleRule = useCallback(async (id: string, active: boolean) => {
    const updated = await updateRule(supabase, id, { active })
    setRules((cur) => cur.map((r) => (r.id === id ? updated : r)))
  }, [supabase])

  const handleDeleteRule = useCallback(async (id: string) => {
    await deleteRule(supabase, id)
    setRules((cur) => cur.filter((r) => r.id !== id))
  }, [supabase])

  const totalUnread =
    messages.filter((m) => !m.read && !m.deletedAt).length +
    fromArtistMessages.filter((m) => !m.readAt && !m.deletedAt).length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col w-full min-h-[400px] md:min-h-[600px] gap-0 rounded-lg border border-border">
      {/* ── Full-width toolbar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-card/20 shrink-0">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search…"
          className="h-7 text-sm flex-1 min-w-[140px]"
        />
        <div className="flex flex-wrap items-center gap-1">
          <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 gap-1 text-xs">
                <PencilSimple size={13} aria-hidden="true" />
                Compose
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>New Message</DialogTitle></DialogHeader>
              <MessageComposer
                artists={artists}
                templates={templates}
                isSending={isSending}
                isArtistsLoading={isLoadingArtists}
                artistLoadError={artistLoadError}
                onSend={handleSend}
                onClose={() => setComposeOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <ExternalEmailComposer />
          <MessageRulesManager
            rules={rules}
            folders={folders}
            onCreate={handleCreateRule}
            onToggle={handleToggleRule}
            onDelete={handleDeleteRule}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
      {/* ── Left: Folder Tree — hidden on mobile ──────────────────────────── */}
      <aside
        className="hidden md:flex flex-col md:w-48 shrink-0 border-r border-border bg-card/40"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mailbox</p>
          {totalUnread > 0 && <Badge className="text-xs px-1.5 py-0">{totalUnread}</Badge>}
        </div>
        <div className="flex-1 overflow-y-auto px-1" style={{ overscrollBehavior: 'contain' }} data-lenis-prevent>
          <FolderTree
            selected={selectedFolder}
            onSelect={(id) => { setSelectedFolder(id); setSelectedMessageId(null) }}
            customFolders={folders}
            unreadCounts={unreadCounts}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            onRenameFolder={handleRenameFolder}
          />
        </div>
      </aside>

      {/* ── Middle: Message List — full width on mobile (hidden when detail is open), fixed on md ── */}
      <div className={cn(
        "flex flex-col border-border",
        selectedMessage || selectedFromArtistMessage
          ? "hidden md:flex md:w-72 md:shrink-0 md:border-r"
          : "flex-1 md:w-72 md:shrink-0 md:border-r",
      )}>
        <div className="flex-1 overflow-y-auto min-h-0" style={{ overscrollBehavior: 'contain' }} data-lenis-prevent>
          {isFromArtistsFolder ? (
            filteredFromArtistMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground text-sm gap-2">
                <p>No messages from artists</p>
              </div>
            ) : (
              filteredFromArtistMessages.map((msg) => {
                const artist = artists.find((a) => a.id === msg.fromArtistId)
                const isSelected = msg.id === selectedMessageId
                return (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => void handleSelectFromArtistMessage(msg.id)}
                    className={cn(
                      'w-full text-left px-3 py-3 border-b border-border/50 transition-colors',
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                      !msg.readAt && !isSelected ? 'bg-card/60' : '',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {!msg.readAt && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-label="Unread" />
                          )}
                          <span className={cn('text-sm truncate', !msg.readAt ? 'font-semibold' : 'font-medium')}>
                            {msg.subject}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {artist?.name ?? 'Unknown artist'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">{formatDate(msg.sentAt)}</span>
                        {msg.starred && <StarFour size={12} weight="fill" className="text-yellow-400" aria-hidden="true" />}
                      </div>
                    </div>
                  </button>
                )
              })
            )
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground text-sm gap-2">
              <p>No messages</p>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const artist = artists.find((a) => a.id === msg.artistId)
              const isSelected = msg.id === selectedMessageId
              return (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => void handleSelectMessage(msg.id)}
                  className={cn(
                    'w-full text-left px-3 py-3 border-b border-border/50 transition-colors',
                    isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                    !msg.read && !isSelected ? 'bg-card/60' : '',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {!msg.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-label="Unread" />
                        )}
                        <span className={cn('text-sm truncate', !msg.read ? 'font-semibold' : 'font-medium')}>
                          {msg.subject}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {msg.isExternal ? (msg.senderEmail ?? 'External') : (artist?.name ?? 'Unknown artist')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">{formatDate(msg.sentAt)}</span>
                      <div className="flex items-center gap-1">
                        {msg.starred && <StarFour size={12} weight="fill" className="text-yellow-400" aria-hidden="true" />}
                        {msg.hasAttachments && <Paperclip size={12} className="text-muted-foreground" aria-hidden="true" />}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Search panel for advanced filters */}
        <div className="border-t border-border">
          <MessageSearch artists={artists} onSearch={handleSearch} />
        </div>
      </div>

      {/* ── Right: Message Detail — hidden on mobile when no message selected ── */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 overflow-hidden",
          !selectedMessage && !selectedFromArtistMessage && "hidden md:flex",
        )}
      >
        {selectedFromArtistMessage ? (
          <>
            <button
              type="button"
              onClick={() => setSelectedMessageId(null)}
              className="md:hidden flex items-center gap-2 px-4 py-2.5 border-b border-border text-sm text-muted-foreground hover:text-foreground transition-colors bg-card/20"
            >
              <ArrowBendUpLeft size={14} aria-hidden="true" />
              Back to messages
            </button>
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border bg-card/20 shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-snug">{selectedFromArtistMessage.subject}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  From: {artists.find((a) => a.id === selectedFromArtistMessage.fromArtistId)?.name ?? 'Unknown artist'}
                  {' · '}
                  {new Date(selectedFromArtistMessage.sentAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => void handlePortalStar(selectedFromArtistMessage.id, !selectedFromArtistMessage.starred)}
                  title={selectedFromArtistMessage.starred ? 'Unstar' : 'Star'}
                >
                  {selectedFromArtistMessage.starred
                    ? <StarFour size={15} weight="fill" className="text-yellow-400" aria-hidden="true" />
                    : <Star size={15} aria-hidden="true" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => void handlePortalDelete(selectedFromArtistMessage.id)}
                  title="Delete"
                >
                  <Trash size={15} aria-hidden="true" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ overscrollBehavior: 'contain' }} data-lenis-prevent>
              {selectedFromArtistMessage.bodyHtml ? (
                <div
                  suppressHydrationWarning
                  className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedFromArtistMessage.bodyHtml) }}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{selectedFromArtistMessage.body}</p>
              )}
              <div className="mt-6">
                <Separator className="mb-4" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  <ArrowBendUpLeft size={12} className="inline mr-1" aria-hidden="true" />
                  Reply to Artist
                </p>
                <QuickReply
                  message={{
                    id: selectedFromArtistMessage.id,
                    artistId: selectedFromArtistMessage.fromArtistId,
                    subject: selectedFromArtistMessage.subject,
                    body: selectedFromArtistMessage.body,
                    bodyHtml: selectedFromArtistMessage.bodyHtml,
                    read: Boolean(selectedFromArtistMessage.readAt),
                    readAt: selectedFromArtistMessage.readAt,
                    starred: selectedFromArtistMessage.starred,
                    deletedAt: selectedFromArtistMessage.deletedAt,
                    sentAt: selectedFromArtistMessage.sentAt,
                  }}
                  artists={artists}
                  templates={templates}
                  isSending={isSending}
                  isArtistsLoading={isLoadingArtists}
                  artistLoadError={artistLoadError}
                  onSend={handleSend}
                />
              </div>
            </div>
          </>
        ) : selectedMessage ? (
          <>
            {/* Mobile back button */}
            <button
              type="button"
              onClick={() => setSelectedMessageId(null)}
              className="md:hidden flex items-center gap-2 px-4 py-2.5 border-b border-border text-sm text-muted-foreground hover:text-foreground transition-colors bg-card/20"
            >
              <ArrowBendUpLeft size={14} aria-hidden="true" />
              Back to messages
            </button>
            {/* Message header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border bg-card/20 shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-snug">{selectedMessage.subject}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedMessage.isExternal
                    ? `From: ${selectedMessage.senderEmail ?? 'External'}`
                    : `From: ${artists.find((a) => a.id === selectedMessage.artistId)?.name ?? 'Unknown artist'}`}
                  {' · '}
                  {new Date(selectedMessage.sentAt).toLocaleString()}
                  {selectedMessage.forwardedFrom && (
                    <span className="ml-1.5 text-primary/70">Forwarded</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Star */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => void handleStar(selectedMessage.id, !selectedMessage.starred)}
                  title={selectedMessage.starred ? 'Unstar' : 'Star'}
                >
                  {selectedMessage.starred
                    ? <StarFour size={15} weight="fill" className="text-yellow-400" aria-hidden="true" />
                    : <Star size={15} aria-hidden="true" />}
                </Button>
                {/* Forward as external email */}
                <ExternalEmailComposer
                  defaultSubject={`Fwd: ${selectedMessage.subject}`}
                  defaultHtml={selectedMessage.bodyHtml ?? selectedMessage.body}
                />
                {/* Export */}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleExport(selectedMessage.id)} title="Export JSON">
                  <Download size={15} aria-hidden="true" />
                </Button>
                {/* Move to folder */}
                {folders.length > 0 && (
                  <select
                    value={selectedMessage.folderId ?? ''}
                    onChange={(e) => void handleMoveToFolder(selectedMessage.id, e.target.value || null)}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label="Move to folder"
                  >
                    <option value="">Inbox</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                )}
                {/* Delete */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => void handleDelete(selectedMessage.id)}
                  title="Delete"
                >
                  <Trash size={15} aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* Message body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ overscrollBehavior: 'contain' }} data-lenis-prevent>
              {selectedMessage.bodyHtml ? (
                <div
                  suppressHydrationWarning
                  className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedMessage.bodyHtml) }}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{selectedMessage.body}</p>
              )}

              {/* Attachments */}
              {loadingAttachments ? (
                <p className="text-xs text-muted-foreground">Loading attachments…</p>
              ) : (
                <AttachmentViewer attachments={attachments} />
              )}

              {/* Thread replies */}
              {(repliesByMessageId[selectedMessage.id] ?? []).length > 0 && (
                <div className="mt-6 space-y-3">
                  <Separator />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Replies ({(repliesByMessageId[selectedMessage.id] ?? []).length})
                  </p>
                  {(repliesByMessageId[selectedMessage.id] ?? [])
                    .filter((r) => !r.deletedAt)
                    .map((reply) => {
                      const replyArtist = artists.find((a) => a.id === reply.artistId)
                      return (
                        <div key={reply.id} className="rounded-lg border border-border bg-card/60 px-4 py-3 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold">{replyArtist?.name ?? 'Artist'}</p>
                            <span className="text-xs text-muted-foreground">{formatDate(reply.sentAt)}</span>
                          </div>
                          {reply.bodyHtml ? (
                            <div
                              suppressHydrationWarning
                              className="prose prose-sm prose-invert max-w-none text-sm"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(reply.bodyHtml) }}
                            />
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}

              {/* Quick reply */}
              <div className="mt-6">
                <Separator className="mb-4" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  <ArrowBendUpLeft size={12} className="inline mr-1" aria-hidden="true" />
                  Quick Reply to Artist
                </p>
                <QuickReply
                  message={selectedMessage}
                  artists={artists}
                  templates={templates}
                  isSending={isSending}
                  isArtistsLoading={isLoadingArtists}
                  artistLoadError={artistLoadError}
                  onSend={handleSend}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[200px] text-muted-foreground text-sm gap-2">
            <ArrowBendUpRight size={32} className="opacity-20" aria-hidden="true" />
            <p>Select a message to read</p>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

// ── QuickReply ────────────────────────────────────────────────────────────────

interface QuickReplyProps {
  message: LabelMessage
  artists: Array<{ id: string; name: string }>
  templates: MessageTemplate[]
  isSending: boolean
  isArtistsLoading: boolean
  artistLoadError: string | null
  onSend: (artistIds: string[], subject: string, html: string, text: string) => Promise<void>
}

function QuickReply({ message, artists, templates, isSending, isArtistsLoading, artistLoadError, onSend }: QuickReplyProps) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ArrowBendUpLeft size={14} aria-hidden="true" />
          Reply to {artists.find((a) => a.id === message.artistId)?.name ?? 'Artist'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Reply</DialogTitle></DialogHeader>
        <MessageComposer
          artists={artists}
          templates={templates}
          isSending={isSending}
          isArtistsLoading={isArtistsLoading}
          artistLoadError={artistLoadError}
          defaultArtistId={message.artistId}
          defaultSubject={`Re: ${message.subject}`}
          onSend={onSend}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

