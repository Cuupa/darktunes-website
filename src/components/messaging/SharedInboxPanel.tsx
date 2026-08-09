'use client'

/**
 * Staff shared-inbox controls for artist→label portal messages:
 * claim/unclaim, priority, internal notes, compliance export.
 */

import { useCallback, useEffect, useState } from 'react'
import { Download, NotePencil, UserCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { MessageInternalNote, PortalMessage } from '@/types'

interface SharedInboxPanelProps {
  message: PortalMessage
  accessToken: string | undefined
  currentUserId: string | undefined
  onMessageUpdated: (message: PortalMessage) => void
}

async function authHeaders(token: string | undefined): Promise<HeadersInit> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

export function SharedInboxPanel({
  message,
  accessToken,
  currentUserId,
  onMessageUpdated,
}: SharedInboxPanelProps) {
  const [notes, setNotes] = useState<MessageInternalNote[]>([])
  const [noteBody, setNoteBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingNotes, setLoadingNotes] = useState(false)

  const loadNotes = useCallback(async () => {
    setLoadingNotes(true)
    try {
      const res = await fetch(
        `/api/admin/messages/${message.id}/notes?source=portal`,
        { headers: await authHeaders(accessToken) },
      )
      if (!res.ok) throw new Error('Failed to load notes')
      const data = (await res.json()) as { notes: MessageInternalNote[] }
      setNotes(data.notes ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load notes')
    } finally {
      setLoadingNotes(false)
    }
  }, [accessToken, message.id])

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])

  const patchOps = async (body: Record<string, unknown>) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/messages/${message.id}/ops`, {
        method: 'PATCH',
        headers: await authHeaders(accessToken),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? 'Update failed')
      }
      const data = (await res.json()) as { message: PortalMessage }
      onMessageUpdated(data.message)
      toast.success('Updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const addNote = async () => {
    if (!noteBody.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/messages/${message.id}/notes`, {
        method: 'POST',
        headers: await authHeaders(accessToken),
        body: JSON.stringify({ body: noteBody, source: 'portal' }),
      })
      if (!res.ok) throw new Error('Failed to add note')
      const data = (await res.json()) as { note: MessageInternalNote }
      setNotes((prev) => [...prev, data.note])
      setNoteBody('')
      toast.success('Note added')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add note')
    } finally {
      setBusy(false)
    }
  }

  const exportJson = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/messages/${message.id}/export`, {
        headers: await authHeaders(accessToken),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `message-${message.id}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exported')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const isMine = Boolean(currentUserId && message.assigneeUserId === currentUserId)
  const priority = message.priority ?? 'normal'

  return (
    <div className="rounded-md border border-border bg-card/40 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          <UserCircle size={14} aria-hidden="true" />
          Shared inbox
        </p>
        {message.assigneeUserId ? (
          <Badge variant={isMine ? 'default' : 'secondary'} className="text-xs">
            {isMine ? 'Assigned to you' : 'Assigned'}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            Unassigned
          </Badge>
        )}
        <Badge variant="outline" className="text-xs capitalize">
          {priority}
        </Badge>
        {(message.tags ?? []).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {!message.assigneeUserId ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void patchOps({ action: 'claim' })}
          >
            Claim
          </Button>
        ) : isMine ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void patchOps({ action: 'unclaim' })}
          >
            Unclaim
          </Button>
        ) : null}

        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Priority"
          disabled={busy}
          value={priority}
          onChange={(e) =>
            void patchOps({
              action: 'update',
              priority: e.target.value,
            })
          }
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          className="gap-1"
          onClick={() => void exportJson()}
        >
          <Download size={14} aria-hidden="true" />
          Export
        </Button>
      </div>

      <Separator />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          <NotePencil size={14} aria-hidden="true" />
          Internal notes
        </p>
        {loadingNotes ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="space-y-2 max-h-40 overflow-y-auto" data-lenis-prevent>
            {notes.map((n) => (
              <li key={n.id} className="rounded border border-border/60 bg-background/50 px-2 py-1.5 text-xs">
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Textarea
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          placeholder="Add a staff-only note…"
          rows={2}
          className="text-sm"
        />
        <Button
          type="button"
          size="sm"
          disabled={busy || !noteBody.trim()}
          onClick={() => void addNote()}
        >
          Add note
        </Button>
      </div>
    </div>
  )
}
