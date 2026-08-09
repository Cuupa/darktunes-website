'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { InterviewRequest } from '@/types'

interface PortalInterviewsClientProps {
  artistId: string
  initialRequests: InterviewRequest[]
}

export function PortalInterviewsClient({
  artistId,
  initialRequests,
}: PortalInterviewsClientProps) {
  const t = useTranslations('portal')

  const [items, setItems] = useState(initialRequests)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const authHeaders = async (): Promise<HeadersInit> => {
    const supabase = createBrowserSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(t('interviews_error'))
    return {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    }
  }

  const requestUrl = (id: string) =>
    `/api/portal/interview-requests/${encodeURIComponent(id)}?artistId=${encodeURIComponent(artistId)}`

  const updateRequest = async (id: string, status: string, artistReply: string) => {
    if (!artistId) {
      toast.error(t('interviews_error'))
      return
    }
    setSavingId(id)
    try {
      const res = await fetch(requestUrl(id), {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ status, artistReply }),
      })
      if (!res.ok) throw new Error(t('interviews_error'))
      const updated = (await res.json()) as InterviewRequest
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success(t('interviews_updated'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('interviews_error'))
    } finally {
      setSavingId(null)
    }
  }

  const deleteRequest = async (id: string) => {
    if (!artistId) {
      toast.error(t('interviews_delete_error'))
      return
    }
    if (!window.confirm(t('interviews_delete_confirm'))) return
    setDeletingId(id)
    try {
      const res = await fetch(requestUrl(id), {
        method: 'DELETE',
        headers: await authHeaders(),
      })
      if (!res.ok) throw new Error(t('interviews_delete_error'))
      setItems((prev) => prev.filter((item) => item.id !== id))
      toast.success(t('interviews_deleted'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('interviews_delete_error'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('interviews_heading')}</h1>
      <div className="space-y-4">
        {items.map((item) => (
          <InterviewCard
            key={item.id}
            request={item}
            saving={savingId === item.id}
            deleting={deletingId === item.id}
            onSave={updateRequest}
            onDelete={deleteRequest}
          />
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">{t('interviews_empty')}</p>}
      </div>
    </div>
  )
}

function InterviewCard({
  request,
  saving,
  deleting,
  onSave,
  onDelete,
}: {
  request: InterviewRequest
  saving: boolean
  deleting: boolean
  onSave: (id: string, status: string, artistReply: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const t = useTranslations('portal')
  const [status, setStatus] = useState(request.status)
  const [artistReply, setArtistReply] = useState(request.artistReply ?? '')
  const busy = saving || deleting

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div>
        <p className="font-medium">{request.subject}</p>
        <p className="text-sm text-muted-foreground">{new Date(request.createdAt).toLocaleDateString()}</p>
      </div>
      <p className="text-sm">{request.message}</p>
      <div className="space-y-1">
        <Label>{t('interviews_status')}</Label>
        <Select value={status} onValueChange={setStatus} disabled={busy}>
          <SelectTrigger className="min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">{t('interviews_status_pending')}</SelectItem>
            <SelectItem value="accepted">{t('interviews_status_accepted')}</SelectItem>
            <SelectItem value="rejected">{t('interviews_status_rejected')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>{t('interviews_reply')}</Label>
        <Textarea
          rows={3}
          value={artistReply}
          onChange={(e) => setArtistReply(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-[44px]"
          disabled={busy}
          onClick={() => void onSave(request.id, status, artistReply)}
        >
          {saving ? t('interviews_saving') : t('interviews_save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] text-destructive border-destructive/40 hover:bg-destructive/10"
          disabled={busy}
          onClick={() => void onDelete(request.id)}
        >
          {deleting ? t('interviews_deleting') : t('interviews_delete')}
        </Button>
      </div>
    </div>
  )
}
