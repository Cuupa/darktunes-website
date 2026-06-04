'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { InterviewRequest } from '@/types'

interface InterviewRequestsClientProps {
  title: string
  initialRequests: InterviewRequest[]
  artists: Array<{ id: string; name: string }>
  labels: {
    artist: string
    subject: string
    message: string
    preferredDate: string
    submit: string
    submitting: string
    empty: string
    error: string
    success: string
    pending: string
    accepted: string
    rejected: string
  }
}

export function InterviewRequestsClient({
  title,
  initialRequests,
  artists,
  labels,
}: InterviewRequestsClientProps) {
  const [items, setItems] = useState(initialRequests)
  const [artistId, setArtistId] = useState(artists[0]?.id ?? '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const getStatusLabel = (status: string) => {
    if (status === 'pending') return labels.pending
    if (status === 'accepted') return labels.accepted
    if (status === 'rejected') return labels.rejected
    return status
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!artistId) return

    setSubmitting(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error(labels.error)

      const res = await fetch('/api/press/interview-requests', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artistId,
          subject,
          message,
          preferredDate: preferredDate || null,
        }),
      })
      if (!res.ok) throw new Error(labels.error)
      const created = (await res.json()) as InterviewRequest
      setItems((prev) => [created, ...prev])
      setSubject('')
      setMessage('')
      setPreferredDate('')
      toast.success(labels.success)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{title}</h1>
      <form onSubmit={submit} className="rounded-lg border border-border p-4 space-y-3">
        <div className="space-y-1">
          <Label>{labels.artist}</Label>
          <Select value={artistId} onValueChange={setArtistId}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
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
        <div className="space-y-1">
          <Label>{labels.subject}</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>{labels.message}</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} />
        </div>
        <div className="space-y-1">
          <Label>{labels.preferredDate}</Label>
          <Input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
        </div>
        <Button type="submit" className="min-h-[44px]" disabled={submitting}>
          {submitting ? labels.submitting : labels.submit}
        </Button>
      </form>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-border p-4">
            <p className="font-medium">{item.subject}</p>
            <p className="text-sm text-muted-foreground">{getStatusLabel(item.status)}</p>
            <p className="mt-2 text-sm">{item.message}</p>
            {item.artistReply && (
              <p className="mt-2 text-sm text-muted-foreground">{item.artistReply}</p>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">{labels.empty}</p>}
      </div>
    </div>
  )
}
