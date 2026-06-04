'use client'

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
import type { Dictionary } from '@/i18n/types'

interface PortalInterviewsClientProps {
  dict: Dictionary['portal']
  initialRequests: InterviewRequest[]
}

export function PortalInterviewsClient({ dict, initialRequests }: PortalInterviewsClientProps) {
  const [items, setItems] = useState(initialRequests)
  const [savingId, setSavingId] = useState<string | null>(null)

  const updateRequest = async (id: string, status: string, artistReply: string) => {
    setSavingId(id)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error(dict.interviews_error)

      const res = await fetch(`/api/portal/interview-requests/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, artistReply }),
      })
      if (!res.ok) throw new Error(dict.interviews_error)
      const updated = (await res.json()) as InterviewRequest
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success(dict.interviews_updated)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.interviews_error)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{dict.interviews_heading}</h1>
      <div className="space-y-4">
        {items.map((item) => (
          <InterviewCard
            key={item.id}
            dict={dict}
            request={item}
            saving={savingId === item.id}
            onSave={updateRequest}
          />
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">{dict.interviews_empty}</p>}
      </div>
    </div>
  )
}

function InterviewCard({
  dict,
  request,
  saving,
  onSave,
}: {
  dict: Dictionary['portal']
  request: InterviewRequest
  saving: boolean
  onSave: (id: string, status: string, artistReply: string) => Promise<void>
}) {
  const [status, setStatus] = useState(request.status)
  const [artistReply, setArtistReply] = useState(request.artistReply ?? '')

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div>
        <p className="font-medium">{request.subject}</p>
        <p className="text-sm text-muted-foreground">{new Date(request.createdAt).toLocaleDateString()}</p>
      </div>
      <p className="text-sm">{request.message}</p>
      <div className="space-y-1">
        <Label>{dict.interviews_status}</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">{dict.interviews_status_pending}</SelectItem>
            <SelectItem value="accepted">{dict.interviews_status_accepted}</SelectItem>
            <SelectItem value="rejected">{dict.interviews_status_rejected}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>{dict.interviews_reply}</Label>
        <Textarea rows={3} value={artistReply} onChange={(e) => setArtistReply(e.target.value)} />
      </div>
      <Button className="min-h-[44px]" disabled={saving} onClick={() => void onSave(request.id, status, artistReply)}>
        {saving ? dict.interviews_saving : dict.interviews_save}
      </Button>
    </div>
  )
}
