'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { ReleaseSubmission, SubmissionStatus } from '@/types'

const STATUS_OPTIONS: SubmissionStatus[] = ['received', 'reviewed', 'accepted', 'rejected']

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  received: 'Received',
  reviewed: 'Reviewed',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

function statusBadgeVariant(status: SubmissionStatus) {
  switch (status) {
    case 'received': return 'secondary'
    case 'reviewed': return 'outline'
    case 'accepted': return 'default'
    case 'rejected': return 'destructive'
  }
}

async function getToken(): Promise<string> {
  const session = await createBrowserSupabaseClient().auth.getSession()
  return session.data.session?.access_token ?? ''
}

export function ReleaseSubmissionsManager() {
  const [submissions, setSubmissions] = useState<ReleaseSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ReleaseSubmission | null>(null)
  const [newStatus, setNewStatus] = useState<SubmissionStatus>('received')
  const [adminReply, setAdminReply] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchSubmissions = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/release-submissions', {
        headers: { Authorization: 'Bearer ' + token },
      })
      if (res.ok) {
        const data = (await res.json()) as ReleaseSubmission[]
        setSubmissions(data)
      }
    } catch {
      toast.error('Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSubmissions()
  }, [fetchSubmissions])

  const openDetail = (sub: ReleaseSubmission) => {
    setSelected(sub)
    setNewStatus(sub.status)
    setAdminReply(sub.adminReply ?? '')
  }

  const saveStatus = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/release-submissions/' + selected.id, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus, adminReply: adminReply || undefined }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Submission updated')
      setSelected(null)
      await fetchSubmissions()
    } catch {
      toast.error('Failed to update submission')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-4">
      {selected ? (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{selected.title}</span>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>← Back</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="font-medium">Type: </span>{selected.type ?? '—'}</div>
              <div><span className="font-medium">Date: </span>{selected.releaseDate ?? '—'}</div>
              <div><span className="font-medium">Genre: </span>{selected.genre ?? '—'}</div>
              <div><span className="font-medium">ISRC: </span>{selected.isrc ?? '—'}</div>
              <div><span className="font-medium">Catalog #: </span>{selected.catalogNumber ?? '—'}</div>
              <div><span className="font-medium">Cover verified: </span>{selected.coverArtVerified ? '✅' : '❌'}</div>
            </div>
            {selected.audioDownloadUrl && (
              <div>
                <a href={selected.audioDownloadUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
                  Audio Download
                </a>
              </div>
            )}
            {selected.coverArtUrl && (
              <div>
                <a href={selected.coverArtUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
                  Cover Art
                </a>
              </div>
            )}
            {selected.notes && <p className="text-sm text-muted-foreground">{selected.notes}</p>}
            <div className="space-y-2">
              <Label>Update Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as SubmissionStatus)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reply to Artist</Label>
              <Textarea
                value={adminReply}
                onChange={(e) => setAdminReply(e.target.value)}
                placeholder="Optional message to artist…"
              />
            </div>
            <Button onClick={() => void saveStatus()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4">Title</th>
                <th className="text-left py-2 pr-4">Type</th>
                <th className="text-left py-2 pr-4">Submitted</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => (
                <tr
                  key={sub.id}
                  className="border-b border-border cursor-pointer hover:bg-muted/30"
                  onClick={() => openDetail(sub)}
                >
                  <td className="py-2 pr-4 font-medium">{sub.title}</td>
                  <td className="py-2 pr-4 capitalize">{sub.type ?? '—'}</td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2">
                    <Badge variant={statusBadgeVariant(sub.status)}>
                      {STATUS_LABELS[sub.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {submissions.length === 0 && (
            <p className="text-muted-foreground py-4">No release submissions yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
