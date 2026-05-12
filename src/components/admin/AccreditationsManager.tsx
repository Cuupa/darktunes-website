'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { listRequests, updateStatus } from '@/lib/api/accreditations'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export function AccreditationsManager() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof listRequests>>>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const rows = await listRequests(supabase)
      setRequests(rows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load accreditation requests')
    }
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  const mutate = async (id: string, status: 'approved' | 'rejected') => {
    setLoadingId(id)
    try {
      await updateStatus(supabase, id, status, notes[id] || null)
      toast.success(`Request ${status}`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update request')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <div key={request.id} className="rounded-lg border border-border p-4 space-y-3">
          <div>
            <p className="font-medium">{request.eventName}</p>
            <p className="text-sm text-muted-foreground">
              {request.publication} · {request.eventDate} · {request.status}
            </p>
          </div>
          <p className="text-sm">{request.reason}</p>
          <Textarea
            value={notes[request.id] ?? request.adminNote ?? ''}
            onChange={(e) => setNotes((prev) => ({ ...prev, [request.id]: e.target.value }))}
            placeholder="Admin note"
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={loadingId === request.id}
              onClick={() => void mutate(request.id, 'approved')}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={loadingId === request.id}
              onClick={() => void mutate(request.id, 'rejected')}
            >
              Reject
            </Button>
          </div>
        </div>
      ))}
      {requests.length === 0 && (
        <p className="text-sm text-muted-foreground">No accreditation requests yet.</p>
      )}
    </div>
  )
}
