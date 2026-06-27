'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { tourPlannerFetch } from '@/lib/tour-planner/clientApi'
import { dbStopToTrack } from '@/lib/tour-planner/mappers'
import { downloadDaySheetPdf } from '@/lib/tour-planner/pdf'
import type { GuestListEntry, VenueContactInfo } from '@/lib/tour-planner/types'
import type { Tour, TourCrewMember, TourMerchItem, TourStop } from '@/types'
import { MapVisualization } from './MapVisualization'

export function MapRoutePanel({ artistId, activeTour, stops }: { artistId: string; activeTour: Tour | null; stops: TourStop[] }) {
  const t = useTranslations('portal')
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => {
      if (!activeTour) throw new Error('no tour')
      const res = await tourPlannerFetch(artistId, '/route', { method: 'POST', body: JSON.stringify({ tourId: activeTour.id }) })
      if (!res.ok) throw new Error('route failed')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tour-planner', 'tours', artistId] }); toast.success(t('tour_planner_route_done')) },
    onError: () => toast.error(t('tour_planner_error')),
  })
  const route = activeTour?.routeCache
  const trackStops = stops.map(dbStopToTrack)
  return (
    <div className="space-y-4">
      <Button disabled={!activeTour || mutation.isPending} onClick={() => mutation.mutate()}>{t('tour_planner_calc_route')}</Button>
      {route?.error && <p className="text-sm text-destructive">{route.error}</p>}
      {route && !route.error && (
        <p className="text-sm text-muted-foreground">
          {t('tour_planner_route_summary', { km: Math.round(route.totalDistance / 1000), min: Math.round(route.totalDuration / 60) })}
        </p>
      )}
      {trackStops.length > 0 && <MapVisualization stops={trackStops} route={route ?? null} />}
    </div>
  )
}

export function CrewPanel({ artistId, tourId }: { artistId: string; tourId: string | null }) {
  const t = useTranslations('portal')
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const { data: crew = [] } = useQuery({
    queryKey: ['tour-planner', 'crew', artistId, tourId],
    enabled: Boolean(tourId),
    queryFn: async () => {
      const res = await tourPlannerFetch(artistId, `/crew?tourId=${tourId}`)
      if (!res.ok) throw new Error('crew')
      return ((await res.json()) as { crew: TourCrewMember[] }).crew
    },
  })
  const create = useMutation({
    mutationFn: async () => {
      const res = await tourPlannerFetch(artistId, '/crew', { method: 'POST', body: JSON.stringify({ tourId, name, role }) })
      if (!res.ok) throw new Error('crew create')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tour-planner', 'crew', artistId, tourId] }); setName(''); setRole('') },
  })
  if (!tourId) return null
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder={t('tour_planner_crew_name')} value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder={t('tour_planner_crew_role')} value={role} onChange={(e) => setRole(e.target.value)} />
        <Button disabled={!name} onClick={() => create.mutate()}>{t('tour_planner_add_crew')}</Button>
      </div>
      <ul className="divide-y divide-border rounded-md border">
        {crew.map((m) => <li key={m.id} className="p-3 text-sm">{m.name} · {m.role}</li>)}
      </ul>
    </div>
  )
}

export function MerchPanel({ artistId }: { artistId: string }) {
  const t = useTranslations('portal')
  const qc = useQueryClient()
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const { data: items = [] } = useQuery({
    queryKey: ['tour-planner', 'merch', artistId],
    queryFn: async () => {
      const res = await tourPlannerFetch(artistId, '/merch')
      if (!res.ok) throw new Error('merch')
      return ((await res.json()) as { items: TourMerchItem[] }).items
    },
  })
  const create = useMutation({
    mutationFn: async () => {
      const res = await tourPlannerFetch(artistId, '/merch', { method: 'POST', body: JSON.stringify({ sku, name }) })
      if (!res.ok) throw new Error('merch create')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tour-planner', 'merch', artistId] }); setSku(''); setName('') },
  })
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
        <Input placeholder={t('tour_planner_merch_name')} value={name} onChange={(e) => setName(e.target.value)} />
        <Button disabled={!sku || !name} onClick={() => create.mutate()}>{t('tour_planner_add_merch')}</Button>
      </div>
      <ul className="divide-y divide-border rounded-md border">
        {items.map((i) => <li key={i.id} className="p-3 text-sm">{i.sku} — {i.name}</li>)}
      </ul>
    </div>
  )
}

export function ImportPanel({ artistId, tourId, onImported }: { artistId: string; tourId: string | null; onImported: () => void }) {
  const t = useTranslations('portal')
  const ref = useRef<HTMLInputElement>(null)
  const importCsv = useMutation({
    mutationFn: async (csv: string) => {
      if (!tourId) throw new Error('no tour')
      const res = await tourPlannerFetch(artistId, '/import', { method: 'POST', body: JSON.stringify({ tourId, csv }) })
      if (!res.ok) throw new Error('import')
      return res.json()
    },
    onSuccess: () => { onImported(); toast.success(t('tour_planner_import_csv_done')) },
    onError: () => toast.error(t('tour_planner_error')),
  })
  if (!tourId) return null
  return (
    <div className="space-y-2">
      <input ref={ref} type="file" accept=".csv,.txt" className="hidden" onChange={async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        importCsv.mutate(await file.text())
        e.target.value = ''
      }} />
      <Button variant="outline" onClick={() => ref.current?.click()} disabled={importCsv.isPending}>{t('tour_planner_import_csv')}</Button>
    </div>
  )
}

export function GuestListForm({ list, onSave }: { list: GuestListEntry[]; onSave: (l: GuestListEntry[]) => void }) {
  const t = useTranslations('portal')
  const [name, setName] = useState('')
  const [guests, setGuests] = useState(1)
  const add = () => {
    if (!name) return
    onSave([...list, { id: crypto.randomUUID(), name, showId: '', numberOfGuests: guests }])
    setName('')
    setGuests(1)
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder={t('tour_planner_guest_name')} value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="number" min={1} value={guests} onChange={(e) => setGuests(Number(e.target.value))} aria-label="Guests" />
        <Button onClick={add}>{t('tour_planner_add_guest')}</Button>
      </div>
      <ul className="text-sm space-y-1">{list.map((g) => <li key={g.id}>{g.name} ({g.numberOfGuests})</li>)}</ul>
    </div>
  )
}

export function VenueContactForm({ info, onSave }: { info: VenueContactInfo | null; onSave: (v: VenueContactInfo) => void }) {
  const t = useTranslations('portal')
  const [draft, setDraft] = useState<VenueContactInfo>(info ?? {})
  const fields: (keyof VenueContactInfo)[] = ['promoterName', 'promoterEmail', 'promoterPhone', 'venueContactName', 'technicalContactName']
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f} className="space-y-1">
          <Label>{f}</Label>
          <Input value={draft[f] ?? ''} onChange={(e) => setDraft({ ...draft, [f]: e.target.value })} />
        </div>
      ))}
      <div className="sm:col-span-2 space-y-1">
        <Label>{t('tour_planner_notes')}</Label>
        <Textarea value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
      </div>
      <Button className="sm:col-span-2" onClick={() => onSave(draft)}>{t('tour_planner_save')}</Button>
    </div>
  )
}

export function DaySheetPdfButton({ stop }: { stop: TourStop }) {
  const t = useTranslations('portal')
  return (
    <Button variant="ghost" size="sm" onClick={() => downloadDaySheetPdf(stop, stop.daySchedule ?? {})}>
      {t('tour_planner_pdf')}
    </Button>
  )
}