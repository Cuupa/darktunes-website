'use client'

import { useEffect, useRef, useState } from 'react'
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
import type {
  GuestListEntry,
  Settlement,
  TourPlannerSettings,
  VenueContactInfo,
  VenueDetails,
} from '@/lib/tour-planner/types'
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

export function LoadInForm({ details, onSave }: { details: VenueDetails | null; onSave: (v: VenueDetails) => void }) {
  const t = useTranslations('portal')
  const [draft, setDraft] = useState<VenueDetails>(details ?? {})
  const fields: (keyof VenueDetails)[] = ['loadingDock', 'powerSupply', 'paSpecs', 'capacity', 'loadInNotes', 'parkingSpaces']
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f} className="space-y-1">
          <Label>{String(f)}</Label>
          <Input value={String(draft[f] ?? '')} onChange={(e) => setDraft({ ...draft, [f]: f === 'capacity' || f === 'parkingSpaces' ? Number(e.target.value) : e.target.value })} />
        </div>
      ))}
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={draft.truckAccess ?? false} onChange={(e) => setDraft({ ...draft, truckAccess: e.target.checked })} />
        truckAccess
      </label>
      <Button className="sm:col-span-2" onClick={() => onSave(draft)}>{t('tour_planner_save')}</Button>
    </div>
  )
}

export function SettlementForm({ settlement, onSave }: { settlement: Settlement | null; onSave: (s: Settlement) => void }) {
  const t = useTranslations('portal')
  const [draft, setDraft] = useState<Settlement>(settlement ?? {
    ticketsSold: 0, ticketPrice: 0, grossRevenue: 0, venueCosts: 0, netRevenue: 0, artistPayment: 0,
  })
  const num = (k: keyof Settlement, v: string) => setDraft({ ...draft, [k]: Number(v) })
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(['ticketsSold', 'ticketPrice', 'grossRevenue', 'venueCosts', 'netRevenue', 'artistPayment'] as const).map((k) => (
        <div key={k} className="space-y-1">
          <Label>{k}</Label>
          <Input type="number" value={draft[k]} onChange={(e) => num(k, e.target.value)} />
        </div>
      ))}
      <Button className="sm:col-span-2" onClick={() => onSave(draft)}>{t('tour_planner_save')}</Button>
    </div>
  )
}

export function SettingsPanel({ artistId, tour, onSaved }: { artistId: string; tour: Tour | null; onSaved: () => void }) {
  const t = useTranslations('portal')
  const [draft, setDraft] = useState<TourPlannerSettings | null>(tour?.settings ?? null)
  useEffect(() => { if (tour) setDraft(tour.settings) }, [tour])
  if (!tour || !draft) return null
  const save = async () => {
    const res = await tourPlannerFetch(artistId, `/tours/${tour.id}`, { method: 'PATCH', body: JSON.stringify({ settings: draft }) })
    if (!res.ok) { toast.error(t('tour_planner_error')); return }
    onSaved(); toast.success(t('tour_planner_saved'))
  }
  return (
    <div className="grid gap-3 max-w-md">
      <div className="space-y-1">
        <Label>{t('tour_planner_vehicle')}</Label>
        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.vehicleType} onChange={(e) => setDraft({ ...draft, vehicleType: e.target.value as TourPlannerSettings['vehicleType'] })}>
          <option value="car">car</option><option value="bus">bus</option><option value="truck">truck</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label>{t('tour_planner_api_provider')}</Label>
        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.apiProvider} onChange={(e) => setDraft({ ...draft, apiProvider: e.target.value as TourPlannerSettings['apiProvider'] })}>
          <option value="nominatim">Nominatim</option><option value="google">Google</option>
        </select>
      </div>
      <Button onClick={save}>{t('tour_planner_save')}</Button>
    </div>
  )
}

export async function geocodeStopVenue(artistId: string, stop: TourStop): Promise<{ lat: number; lng: number } | null> {
  const q = [stop.venueAddress, stop.venueCity, stop.venueCountry].filter(Boolean).join(', ')
  if (!q) return null
  const res = await tourPlannerFetch(artistId, '/geocode', { method: 'POST', body: JSON.stringify({ query: q }) })
  if (!res.ok) return null
  const json = (await res.json()) as { coords?: { lat: number; lon: number } }
  return json.coords ? { lat: json.coords.lat, lng: json.coords.lon } : null
}

export function DaySheetPdfButton({ stop }: { stop: TourStop }) {
  const t = useTranslations('portal')
  return (
    <Button variant="ghost" size="sm" onClick={() => downloadDaySheetPdf(stop, stop.daySchedule ?? {})}>
      {t('tour_planner_pdf')}
    </Button>
  )
}