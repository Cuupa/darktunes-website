'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Dictionary } from '@/i18n/types'
import type { Concert } from '@/types'

interface TourListProps {
  dict: Dictionary['portal']
  concerts: Concert[]
  artistId: string | null
  artistName: string
}

type Status = 'announced' | 'confirmed' | 'cancelled'

export function TourList({ dict, concerts, artistId, artistName }: TourListProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [items, setItems] = useState(concerts)
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

    const { data, error } = await supabase
      .from('concerts')
      .insert({
        artist_id: artistId,
        artist_name: artistName,
        event_name: form.eventName,
        concert_date: form.concertDate,
        venue_name: form.venueName || null,
        venue_city: form.venueCity || null,
        venue_country: form.venueCountry || null,
        ticket_url: form.ticketUrl || null,
        status,
      })
      .select()
      .single()

    if (error) {
      toast.error(error.message)
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
      },
      ...prev,
    ])
    setForm({ eventName: '', concertDate: '', venueName: '', venueCity: '', venueCountry: '', ticketUrl: '' })
    toast.success('Tour date created')
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('concerts').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
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
          <Input id="tour-event" value={form.eventName} onChange={(e) => setForm((v) => ({ ...v, eventName: e.target.value }))} required />
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
        {items.length === 0 && <p className="text-sm text-muted-foreground">{dict.tour_noData}</p>}
      </div>
    </div>
  )
}
