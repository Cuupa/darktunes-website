'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { tourPlannerFetch } from '@/lib/tour-planner/clientApi'
import type { DaySchedule, DealStructure, ShowStatus } from '@/lib/tour-planner/types'
import type { Tour, TourContact, TourStop, TourTask } from '@/types'
import {
  CrewPanel,
  DaySheetPdfButton,
  GuestListForm,
  ImportPanel,
  MapRoutePanel,
  MerchPanel,
  VenueContactForm,
} from './TourPlannerExtras'

const DAY_FIELDS: (keyof DaySchedule)[] = [
  'getIn', 'soundcheck', 'doors', 'stageTime', 'curfew', 'dinnerTime', 'lobbyCall', 'hotelDeparture',
]

export function TourPlannerTabs({
  artistId,
  activeTour,
  stops,
  onStopsChange,
}: {
  artistId: string
  activeTour: Tour | null
  stops: TourStop[]
  onStopsChange: () => void
}) {
  const t = useTranslations('portal')

  return (
    <Tabs defaultValue="stops" className="w-full">
      <TabsList className="flex flex-wrap h-auto gap-1">
        <TabsTrigger value="stops">{t('tour_planner_tab_stops')}</TabsTrigger>
        <TabsTrigger value="route">{t('tour_planner_tab_route')}</TabsTrigger>
        <TabsTrigger value="tasks">{t('tour_planner_tab_tasks')}</TabsTrigger>
        <TabsTrigger value="contacts">{t('tour_planner_tab_contacts')}</TabsTrigger>
        <TabsTrigger value="crew">{t('tour_planner_tab_crew')}</TabsTrigger>
        <TabsTrigger value="merch">{t('tour_planner_tab_merch')}</TabsTrigger>
        <TabsTrigger value="import">{t('tour_planner_tab_import')}</TabsTrigger>
      </TabsList>
      <TabsContent value="stops" className="mt-4">
        <StopsPanel artistId={artistId} stops={stops} onUpdated={onStopsChange} />
      </TabsContent>
      <TabsContent value="route" className="mt-4">
        <MapRoutePanel artistId={artistId} activeTour={activeTour} stops={stops} />
      </TabsContent>
      <TabsContent value="tasks" className="mt-4">
        <TasksPanel artistId={artistId} tourId={activeTour?.id ?? null} />
      </TabsContent>
      <TabsContent value="contacts" className="mt-4">
        <ContactsPanel artistId={artistId} />
      </TabsContent>
      <TabsContent value="crew" className="mt-4">
        <CrewPanel artistId={artistId} tourId={activeTour?.id ?? null} />
      </TabsContent>
      <TabsContent value="merch" className="mt-4">
        <MerchPanel artistId={artistId} />
      </TabsContent>
      <TabsContent value="import" className="mt-4">
        <ImportPanel artistId={artistId} tourId={activeTour?.id ?? null} onImported={onStopsChange} />
      </TabsContent>
    </Tabs>
  )
}

function StopsPanel({
  artistId,
  stops,
  onUpdated,
}: {
  artistId: string
  stops: TourStop[]
  onUpdated: () => void
}) {
  const t = useTranslations('portal')
  if (!stops.length) return <p className="text-sm text-muted-foreground">{t('tour_planner_no_stops')}</p>

  return (
    <ul className="space-y-3">
      {stops.map((stop) => (
        <StopCard key={stop.id} artistId={artistId} stop={stop} onUpdated={onUpdated} />
      ))}
    </ul>
  )
}

function StopCard({ artistId, stop, onUpdated }: { artistId: string; stop: TourStop; onUpdated: () => void }) {
  const t = useTranslations('portal')
  const [open, setOpen] = useState<'day' | 'finance' | 'guest' | 'venue' | null>(null)

  const patchStop = async (body: Record<string, unknown>) => {
    const res = await tourPlannerFetch(artistId, `/stops/${stop.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('patch failed')
    onUpdated()
  }

  return (
    <li className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{stop.venueName ?? t('tour_planner_unnamed_stop')}</p>
          <p className="text-sm text-muted-foreground">{stop.stopDate}{stop.venueCity ? ` · ${stop.venueCity}` : ''}</p>
        </div>
        <ShowStatusSelect value={stop.showStatus} onChange={(showStatus) => patchStop({ showStatus }).catch(() => toast.error(t('tour_planner_error')))} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Dialog open={open === 'day'} onOpenChange={(v) => setOpen(v ? 'day' : null)}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">{t('tour_planner_day_sheet')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('tour_planner_day_sheet')}</DialogTitle></DialogHeader>
            <DaySheetForm
              schedule={stop.daySchedule ?? {}}
              onSave={(daySchedule) => patchStop({ daySchedule }).then(() => { setOpen(null); toast.success(t('tour_planner_saved')) }).catch(() => toast.error(t('tour_planner_error')))}
            />
          </DialogContent>
        </Dialog>
        <Dialog open={open === 'finance'} onOpenChange={(v) => setOpen(v ? 'finance' : null)}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">{t('tour_planner_finance')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('tour_planner_finance')}</DialogTitle></DialogHeader>
            <FinanceForm
              deal={stop.deal}
              onSave={(deal) => patchStop({ deal }).then(() => { setOpen(null); toast.success(t('tour_planner_saved')) }).catch(() => toast.error(t('tour_planner_error')))}
            />
          </DialogContent>
        </Dialog>
        <Dialog open={open === 'guest'} onOpenChange={(v) => setOpen(v ? 'guest' : null)}>
          <DialogTrigger asChild><Button variant="outline" size="sm">{t('tour_planner_guest_list')}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('tour_planner_guest_list')}</DialogTitle></DialogHeader>
            <GuestListForm list={stop.guestList} onSave={(guestList) => patchStop({ guestList }).then(() => { setOpen(null); toast.success(t('tour_planner_saved')) }).catch(() => toast.error(t('tour_planner_error')))} />
          </DialogContent>
        </Dialog>
        <Dialog open={open === 'venue'} onOpenChange={(v) => setOpen(v ? 'venue' : null)}>
          <DialogTrigger asChild><Button variant="outline" size="sm">{t('tour_planner_venue_contacts')}</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t('tour_planner_venue_contacts')}</DialogTitle></DialogHeader>
            <VenueContactForm info={stop.venueContactInfo} onSave={(venueContactInfo) => patchStop({ venueContactInfo }).then(() => { setOpen(null); toast.success(t('tour_planner_saved')) }).catch(() => toast.error(t('tour_planner_error')))} />
          </DialogContent>
        </Dialog>
        <DaySheetPdfButton stop={stop} />
      </div>
    </li>
  )
}

function ShowStatusSelect({ value, onChange }: { value: ShowStatus; onChange: (v: ShowStatus) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ShowStatus)}>
      <SelectTrigger className="w-[160px]" aria-label="Show status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(['option', 'confirmed', 'contract-sent', 'deposit-paid', 'cancelled'] as ShowStatus[]).map((s) => (
          <SelectItem key={s} value={s}>{s}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function DaySheetForm({ schedule, onSave }: { schedule: DaySchedule; onSave: (s: DaySchedule) => void }) {
  const t = useTranslations('portal')
  const [draft, setDraft] = useState<DaySchedule>(schedule)
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DAY_FIELDS.map((field) => (
        <div key={field} className="space-y-1">
          <Label htmlFor={field}>{field}</Label>
          <Input id={field} value={draft[field] ?? ''} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} />
        </div>
      ))}
      <Button className="sm:col-span-2" onClick={() => onSave(draft)}>{t('tour_planner_save')}</Button>
    </div>
  )
}

function FinanceForm({ deal, onSave }: { deal: DealStructure | null; onSave: (d: DealStructure) => void }) {
  const t = useTranslations('portal')
  const [draft, setDraft] = useState<DealStructure>(deal ?? { type: 'guarantee', currency: 'EUR', guarantee: 0 })
  return (
    <div className="grid gap-3">
      <div className="space-y-1">
        <Label>{t('tour_planner_deal_type')}</Label>
        <Select value={draft.type} onValueChange={(type) => setDraft({ ...draft, type: type as DealStructure['type'] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="guarantee">Guarantee</SelectItem>
            <SelectItem value="door-split">Door split</SelectItem>
            <SelectItem value="versus">Versus</SelectItem>
            <SelectItem value="bonus">Bonus</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>{t('tour_planner_guarantee')}</Label>
        <Input type="number" value={draft.guarantee ?? 0} onChange={(e) => setDraft({ ...draft, guarantee: Number(e.target.value) })} />
      </div>
      <Button onClick={() => onSave(draft)}>{t('tour_planner_save')}</Button>
    </div>
  )
}

function TasksPanel({ artistId, tourId }: { artistId: string; tourId: string | null }) {
  const t = useTranslations('portal')
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const { data: tasks = [] } = useQuery({
    queryKey: ['tour-planner', 'tasks', artistId],
    queryFn: async () => {
      const res = await tourPlannerFetch(artistId, '/tasks')
      if (!res.ok) throw new Error('tasks')
      return ((await res.json()) as { tasks: TourTask[] }).tasks
    },
  })
  const create = useMutation({
    mutationFn: async () => {
      const res = await tourPlannerFetch(artistId, '/tasks', {
        method: 'POST',
        body: JSON.stringify({ title, dueDate, tourId }),
      })
      if (!res.ok) throw new Error('create task')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tour-planner', 'tasks', artistId] }); setTitle(''); setDueDate(''); },
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input placeholder={t('tour_planner_task_title')} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <Button disabled={!title || !dueDate} onClick={() => create.mutate()}>{t('tour_planner_add_task')}</Button>
      </div>
      <ul className="divide-y divide-border rounded-md border">
        {tasks.map((task) => (
          <li key={task.id} className="p-3 text-sm flex justify-between">
            <span>{task.title}</span>
            <span className="text-muted-foreground">{task.dueDate}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ContactsPanel({ artistId }: { artistId: string }) {
  const t = useTranslations('portal')
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const { data: contacts = [] } = useQuery({
    queryKey: ['tour-planner', 'contacts', artistId],
    queryFn: async () => {
      const res = await tourPlannerFetch(artistId, '/contacts')
      if (!res.ok) throw new Error('contacts')
      return ((await res.json()) as { contacts: TourContact[] }).contacts
    },
  })
  const create = useMutation({
    mutationFn: async () => {
      const res = await tourPlannerFetch(artistId, '/contacts', { method: 'POST', body: JSON.stringify({ name }) })
      if (!res.ok) throw new Error('create contact')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tour-planner', 'contacts', artistId] }); setName('') },
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder={t('tour_planner_contact_name')} value={name} onChange={(e) => setName(e.target.value)} />
        <Button disabled={!name} onClick={() => create.mutate()}>{t('tour_planner_add_contact')}</Button>
      </div>
      <ul className="divide-y divide-border rounded-md border">
        {contacts.map((c) => (
          <li key={c.id} className="p-3 text-sm">{c.name}{c.company ? ` · ${c.company}` : ''}</li>
        ))}
      </ul>
    </div>
  )
}