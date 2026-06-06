'use client'

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
import type { Dictionary } from '@/i18n/types'
import type { Concert } from '@/types'
import { createTourDate, deleteTourDate } from '../_actions/tour'

interface TourListProps {
  dict: Dictionary['portal']
  concerts: Concert[]
  artistId: string | null
}

type Status = 'announced' | 'confirmed' | 'cancelled'

export function TourList({ dict, concerts, artistId }: TourListProps) {
  const [items, setItems] = useState(concerts)
  const eventInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>('announced')
  const [form, setForm] = useState({
    eventName: '',
    concertDate: '',
    venueName: '',
    venueCity: '',
    venueCountry: '',
    ticketUrl: '',
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!artistId || !form.eventName || !form.concertDate) return

    let data: Awaited<ReturnType<typeof createTourDate>>
    try {
      data = await createTourDate({
        eventName: form.eventName,
        concertDate: form.concertDate,
        venueName: form.venueName,
        venueCity: form.venueCity,
        venueCountry: form.venueCountry,
        ticketUrl: form.ticketUrl,
        status,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create tour date')
      return
    }

    setItems((prev) => [
      {
        id: data.id,
        artistId: data.artist_id,
        artistName: data.artist_name,
        eventName: data.event_name,
        venueName: data.venue_name,
        venueCity: data.venue_city,
        venueCountry: data.venue_country,
        concertDate: data.concert_date,
        ticketUrl: data.ticket_url,
        songkickId: data.songkick_id,
        bandsintownId: data.bandsintown_id,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        eventTime: null,
        eventType: 'gig',
        trailerUrl: null,
        venueLat: null,
        venueLng: null,
        venueOsmId: null,
        newsPostId: null,
      },
      ...prev,
    ])
    setForm({ eventName: '', concertDate: '', venueName: '', venueCity: '', venueCountry: '', ticketUrl: '' })
    toast.success('Tour date created')
  }

  const remove = async (id: string) => {
    if (!window.confirm('Delete this tour date?')) return
    try {
      await deleteTourDate(id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete tour date')
      return
    }
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{dict.tour_heading}</h1>

      <form onSubmit={submit} className="rounded-lg border border-border p-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="tour-event">Event</Label>
          <Input id="tour-event" ref={eventInputRef} value={form.eventName} onChange={(e) => setForm((v) => ({ ...v, eventName: e.target.value }))} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tour-date">Date</Label>
          <Input id="tour-date" type="date" value={form.concertDate} onChange={(e) => setForm((v) => ({ ...v, concertDate: e.target.value }))} required />
        </div>
        <Input placeholder="Venue" value={form.venueName} onChange={(e) => setForm((v) => ({ ...v, venueName: e.target.value }))} />
        <Input placeholder="City" value={form.venueCity} onChange={(e) => setForm((v) => ({ ...v, venueCity: e.target.value }))} />
        <Input placeholder="Country" value={form.venueCountry} onChange={(e) => setForm((v) => ({ ...v, venueCountry: e.target.value }))} />
        <Input placeholder="Ticket URL" value={form.ticketUrl} onChange={(e) => setForm((v) => ({ ...v, ticketUrl: e.target.value }))} />
        <div className="md:col-span-2 flex items-center gap-2">
          <Select value={status} onValueChange={(value) => setStatus(value as Status)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="announced">announced</SelectItem>
              <SelectItem value="confirmed">confirmed</SelectItem>
              <SelectItem value="cancelled">cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit">Add date</Button>
        </div>
      </form>

      <div className="space-y-3">
        {items.map((concert) => (
          <div key={concert.id} className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{concert.eventName}</p>
              <p className="text-sm text-muted-foreground">
                {concert.concertDate} · {[concert.venueName, concert.venueCity, concert.venueCountry].filter(Boolean).join(', ')} · {concert.status}
              </p>
            </div>
            <Button size="sm" variant="destructive" onClick={() => void remove(concert.id)}>
              Delete
            </Button>
          </div>
        ))}
        {items.length === 0 && (
          <PortalEmptyState
            icon={MapPin}
            heading={dict.tour_noData}
            description="No tour dates yet."
            action={{ label: '+ Add Date', onClick: () => eventInputRef.current?.focus() }}
          />
        )}
      </div>
    </div>
  )
}
