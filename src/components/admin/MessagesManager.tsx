'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { sendMessage } from '@/lib/api/labelMessages'
import { getArtists } from '@/lib/api/artists'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SentMessageRow {
  id: string
  subject: string
  artistName: string
  read: boolean
  sentAt: string
}

export function MessagesManager() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [artistId, setArtistId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [artists, setArtists] = useState<Array<{ id: string; name: string }>>([])
  const [messages, setMessages] = useState<SentMessageRow[]>([])
  const [isSending, setIsSending] = useState(false)

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

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!artistId || !subject.trim() || !body.trim()) return
    setIsSending(true)
    try {
      await sendMessage(supabase, artistId, subject.trim(), body.trim())
      await load()
      setSubject('')
      setBody('')
      toast.success('Message sent')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSend} className="space-y-4 rounded-lg border border-border p-4">
        <div className="space-y-2">
          <Label>Artist</Label>
          <Select value={artistId} onValueChange={setArtistId}>
            <SelectTrigger>
              <SelectValue placeholder="Select artist" />
            </SelectTrigger>
            <SelectContent>
              {artists.map((artist) => (
                <SelectItem key={artist.id} value={artist.id}>
                  {artist.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="message-subject">Subject</Label>
          <Input id="message-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="message-body">Body</Label>
          <Textarea id="message-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <Button type="submit" disabled={isSending || !artistId || !subject.trim() || !body.trim()}>
          {isSending ? 'Sending…' : 'Send Message'}
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
