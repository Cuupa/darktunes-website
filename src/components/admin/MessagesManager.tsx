'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { sendMessage } from '@/lib/api/labelMessages'
import { getArtists } from '@/lib/api/artists'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Check, X } from '@phosphor-icons/react'

interface SentMessageRow {
  id: string
  subject: string
  artistName: string
  read: boolean
  sentAt: string
}

const ALL_ARTISTS_ID = '__all__'

export function MessagesManager() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [artists, setArtists] = useState<Array<{ id: string; name: string }>>([])
  const [messages, setMessages] = useState<SentMessageRow[]>([])
  const [isSending, setIsSending] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const [artistRows, messageRows] = await Promise.all([
        getArtists(supabase),
        supabase
          .from('label_messages')
          .select('id, artist_id, subject, read, sent_at')
          .order('sent_at', { ascending: false })
          .limit(50),
      ])
      const artistMap = new Map(artistRows.map((a) => [a.id, a.name]))
      setArtists(artistRows.map((a) => ({ id: a.id, name: a.name })))
      if (messageRows.error) throw messageRows.error
      setMessages(
        (messageRows.data ?? []).map((row) => ({
          id: row.id,
          subject: row.subject,
          artistName: artistMap.get(row.artist_id) ?? 'Unknown',
          read: row.read,
          sentAt: row.sent_at,
        })),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load messages')
    }
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleArtist = (id: string) => {
    if (id === ALL_ARTISTS_ID) {
      // Select all / deselect all
      setSelectedArtistIds((prev) =>
        prev.includes(ALL_ARTISTS_ID) ? [] : [ALL_ARTISTS_ID, ...artists.map((a) => a.id)]
      )
    } else {
      setSelectedArtistIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.filter((x) => x !== ALL_ARTISTS_ID), id]
        // If all individual artists selected, also check "all"
        return next.length === artists.length ? [ALL_ARTISTS_ID, ...artists.map((a) => a.id)] : next
      })
    }
  }

  const removeArtist = (id: string) => {
    setSelectedArtistIds((prev) => prev.filter((x) => x !== id && x !== ALL_ARTISTS_ID))
  }

  const targetArtistIds = selectedArtistIds.includes(ALL_ARTISTS_ID)
    ? artists.map((a) => a.id)
    : selectedArtistIds

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (targetArtistIds.length === 0 || !subject.trim() || !body.trim()) return
    setIsSending(true)
    try {
      await Promise.all(
        targetArtistIds.map((id) => sendMessage(supabase, id, subject.trim(), body.trim()))
      )
      await load()
      setSubject('')
      setBody('')
      setSelectedArtistIds([])
      toast.success(`Message sent to ${targetArtistIds.length} artist${targetArtistIds.length > 1 ? 's' : ''}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const selectedLabels = selectedArtistIds.includes(ALL_ARTISTS_ID)
    ? [{ id: ALL_ARTISTS_ID, name: 'All Artists' }]
    : artists.filter((a) => selectedArtistIds.includes(a.id))

  return (
    <div className="space-y-6">
      <form onSubmit={onSend} className="space-y-4 rounded-lg border border-border p-4">
        {/* Multi-select artist picker */}
        <div className="space-y-2">
          <Label>Artist(s)</Label>
          <div ref={dropdownRef} className="relative">
            {/* Trigger */}
            <button
              type="button"
              className="w-full flex flex-wrap items-center gap-1.5 min-h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-left hover:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => setDropdownOpen((v) => !v)}
            >
              {selectedLabels.length === 0 ? (
                <span className="text-muted-foreground">Select artist(s)…</span>
              ) : (
                selectedLabels.map((a) => (
                  <Badge key={a.id} variant="secondary" className="flex items-center gap-1 pr-1">
                    {a.name}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${a.name}`}
                      className="ml-0.5 rounded-full hover:bg-destructive/20 cursor-pointer"
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        removeArtist(a.id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          removeArtist(a.id)
                        }
                      }}
                    >
                      <X size={12} />
                    </span>
                  </Badge>
                ))
              )}
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div
                className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-y-auto"
                style={{ maxHeight: 220 }}
                onWheel={(e) => e.stopPropagation()}
              >
                {/* All Artists option */}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors font-semibold border-b border-border"
                  onClick={() => toggleArtist(ALL_ARTISTS_ID)}
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded border border-primary">
                    {selectedArtistIds.includes(ALL_ARTISTS_ID) && <Check size={10} weight="bold" />}
                  </span>
                  All Artists
                </button>
                {artists.map((artist) => (
                  <button
                    key={artist.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => toggleArtist(artist.id)}
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded border border-primary">
                      {selectedArtistIds.includes(artist.id) && <Check size={10} weight="bold" />}
                    </span>
                    {artist.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message-subject">Subject</Label>
          <Input id="message-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="message-body">Body</Label>
          <Textarea id="message-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <Button type="submit" disabled={isSending || targetArtistIds.length === 0 || !subject.trim() || !body.trim()}>
          {isSending ? 'Sending…' : `Send Message${targetArtistIds.length > 1 ? ` to ${targetArtistIds.length} Artists` : ''}`}
        </Button>
      </form>

      <div className="rounded-lg border border-border divide-y divide-border">
        {messages.map((message) => (
          <div key={message.id} className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{message.subject}</p>
              <p className="text-sm text-muted-foreground">
                {message.artistName} · {new Date(message.sentAt).toLocaleString()}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{message.read ? 'Read' : 'Unread'}</span>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">No messages sent yet.</div>
        )}
      </div>
    </div>
  )
}
