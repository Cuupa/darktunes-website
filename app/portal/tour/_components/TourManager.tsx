'use client'

import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { MapPin } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PortalEmptyState } from '@/components/portal/PortalEmptyState'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Concert } from '@/types'

interface TourManagerProps {
  concerts: Concert[]
  artistId: string | null
}

type Status = 'announced' | 'confirmed' | 'cancelled'

const EMPTY_FORM = {
  eventName: '',
  concertDate: '',
  venueName: '',
  venueCity: '',
  venueCountry: '',
  ticketUrl: '',
}

export function TourManager({ concerts, artistId }: TourManagerProps) {
  const t = useTranslations('portal')

  const [items, setItems] = useState(concerts)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('announced')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const eventInputRef = useRef<HTMLInputElement>(null)

  const withToken = async () => {
    const supabase = createBrowserSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(t('tour_error'))
    return session.access_token
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!artistId || !form.eventName || !form.concertDate) return

    setSaving(true)
    try {
      const token = await withToken()
      const res = await fetch('/api/portal/concerts', {
        method: editingId ? 'PATCH' : 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          eventName: form.eventName,
          concertDate: form.concertDate,
          venueName: form.venueName || null,
          venueCity: form.venueCity || null,
          venueCountry: form.venueCountry || null,
          ticketUrl: form.ticketUrl || null,
          status,
        }),
      })
      if (!res.ok) throw new Error(t('tour_error'))

      const data = (await res.json()) as Concert
      if (editingId) {
        setItems((prev) => prev.map((item) => (item.id === editingId ? data : item)))
        toast.success(t('tour_updated'))
      } else {
        setItems((prev) => [data, ...prev])
        toast.success(t('tour_created'))
      }

      setEditingId(null)
      setStatus('announced')
      setForm(EMPTY_FORM)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('tour_error'))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (concert: Concert) => {
    setEditingId(concert.id)
    setStatus((concert.status as Status) ?? 'announced')
    setForm({
      eventName: concert.eventName,
      concertDate: concert.concertDate.slice(0, 10),
      venueName: concert.venueName ?? '',
      venueCity: concert.venueCity ?? '',
      venueCountry: concert.venueCountry ?? '',
      ticketUrl: concert.ticketUrl ?? '',
    })
    eventInputRef.current?.focus()
  }

  const cancelEdit = () => {
    setEditingId(null)
    setStatus('announced')
    setForm(EMPTY_FORM)
  }

  const confirmRemove = async () => {
    if (!deleteTarget) return
    const id = deleteTarget
    setDeleteTarget(null)
    try {
      const token = await withToken()
      const res = await fetch(`/api/portal/concerts?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!res.ok) throw new Error(t('tour_error'))
      setItems((prev) => prev.filter((item) => item.id !== id))
      toast.success(t('tour_deleted'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('tour_error'))
    }
  }

  const getStatusLabel = (value: string) => {
    if (value === 'announced') return t('tour_status_announced')
    if (value === 'confirmed') return t('tour_status_confirmed')
    if (value === 'cancelled') return t('tour_status_cancelled')
    return value
  }

  return (
    <div className="space-y-6">
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tour_delete_confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('tour_delete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('tour_cancel_edit')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmRemove()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('tour_delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <h1 className="text-3xl font-bold">{t('tour_heading')}</h1>

      <form onSubmit={submit} className="rounded-lg border border-border p-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="tour-event">{t('tour_event')}</Label>
          <Input
            id="tour-event"
            ref={eventInputRef}
            value={form.eventName}
            onChange={(e) => setForm((value) => ({ ...value, eventName: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tour-date">{t('tour_date')}</Label>
          <Input
            id="tour-date"
            type="date"
            value={form.concertDate}
            onChange={(e) => setForm((value) => ({ ...value, concertDate: e.target.value }))}
            required
          />
        </div>
        <Input
          placeholder={t('tour_venue')}
          value={form.venueName}
          onChange={(e) => setForm((value) => ({ ...value, venueName: e.target.value }))}
        />
        <Input
          placeholder={t('tour_city')}
          value={form.venueCity}
          onChange={(e) => setForm((value) => ({ ...value, venueCity: e.target.value }))}
        />
        <Input
          placeholder={t('tour_country')}
          value={form.venueCountry}
          onChange={(e) => setForm((value) => ({ ...value, venueCountry: e.target.value }))}
        />
        <Input
          placeholder={t('tour_ticket_url')}
          value={form.ticketUrl}
          onChange={(e) => setForm((value) => ({ ...value, ticketUrl: e.target.value }))}
        />
        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={(value) => setStatus(value as Status)}>
            <SelectTrigger className="w-44 min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="announced">{t('tour_status_announced')}</SelectItem>
              <SelectItem value="confirmed">{t('tour_status_confirmed')}</SelectItem>
              <SelectItem value="cancelled">{t('tour_status_cancelled')}</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" className="min-h-[44px]" disabled={saving}>
            {saving ? t('tour_saving') : editingId ? t('tour_update') : t('tour_add')}
          </Button>
          {editingId && (
            <Button type="button" className="min-h-[44px]" variant="outline" onClick={cancelEdit}>
              {t('tour_cancel_edit')}
            </Button>
          )}
        </div>
      </form>

      <div className="space-y-3">
        {items.map((concert) => (
          <div key={concert.id} className="rounded-lg border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{concert.eventName}</p>
              <p className="text-sm text-muted-foreground">
                {concert.concertDate.slice(0, 10)} · {[concert.venueName, concert.venueCity, concert.venueCountry].filter(Boolean).join(', ')} · {getStatusLabel(concert.status)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" className="min-h-[44px] min-w-[44px]" variant="outline" onClick={() => startEdit(concert)}>
                {t('tour_edit')}
              </Button>
              <Button size="sm" className="min-h-[44px] min-w-[44px]" variant="destructive" onClick={() => setDeleteTarget(concert.id)}>
                {t('tour_delete')}
              </Button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <PortalEmptyState
            icon={MapPin}
            heading={t('tour_noData')}
            description={t('tour_empty_description')}
            action={{ label: t('tour_add'), onClick: () => eventInputRef.current?.focus() }}
          />
        )}
      </div>
    </div>
  )
}
