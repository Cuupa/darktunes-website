'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { createRequest } from '@/lib/api/accreditations'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { Database } from '@/types/database'

type AccreditationRow = Database['public']['Tables']['accreditation_requests']['Row']

interface AccreditationClientProps {
  initialRequests: AccreditationRow[]
  journalistId: string
}

export function AccreditationClient({ initialRequests, journalistId }: AccreditationClientProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [requests, setRequests] = useState(initialRequests)
  const [form, setForm] = useState({
    eventName: '',
    eventDate: '',
    publication: '',
    reason: '',
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const created = await createRequest(supabase, {
        journalist_id: journalistId,
        event_name: form.eventName,
        event_date: form.eventDate,
        publication: form.publication,
        reason: form.reason,
      })
      setRequests((prev) => [
        {
          id: created.id,
          journalist_id: created.journalistId,
          event_name: created.eventName,
          event_date: created.eventDate,
          publication: created.publication,
          reason: created.reason,
          status: created.status,
          admin_note: created.adminNote ?? null,
          created_at: created.createdAt,
          updated_at: created.updatedAt,
        },
        ...prev,
      ])
      setForm({ eventName: '', eventDate: '', publication: '', reason: '' })
      toast.success('Accreditation request submitted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit request')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Accreditation</h1>
      <form onSubmit={submit} className="rounded-lg border border-border p-4 space-y-3">
        <div className="space-y-1">
          <Label>Event name</Label>
          <Input value={form.eventName} onChange={(e) => setForm((v) => ({ ...v, eventName: e.target.value }))} required />
        </div>
        <div className="space-y-1">
          <Label>Event date</Label>
          <Input type="date" value={form.eventDate} onChange={(e) => setForm((v) => ({ ...v, eventDate: e.target.value }))} required />
        </div>
        <div className="space-y-1">
          <Label>Publication</Label>
          <Input value={form.publication} onChange={(e) => setForm((v) => ({ ...v, publication: e.target.value }))} required />
        </div>
        <div className="space-y-1">
          <Label>Reason</Label>
          <Textarea value={form.reason} onChange={(e) => setForm((v) => ({ ...v, reason: e.target.value }))} required rows={4} />
        </div>
        <Button type="submit">Submit request</Button>
      </form>

      <div className="space-y-3">
        {requests.map((request) => (
          <div key={request.id} className="rounded-lg border border-border p-4">
            <p className="font-medium">{request.event_name}</p>
            <p className="text-sm text-muted-foreground">
              {request.publication} · {request.event_date} · {request.status}
            </p>
            {request.admin_note && (
              <p className="mt-2 text-sm text-muted-foreground">Admin note: {request.admin_note}</p>
            )}
          </div>
        ))}
        {requests.length === 0 && <p className="text-sm text-muted-foreground">No requests submitted yet.</p>}
      </div>
    </div>
  )
}
