'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Trash } from '@phosphor-icons/react'
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
import { tourPlannerFetch, wasQueuedOffline } from '@/lib/tour-planner/clientApi'
import {
  useTourPlannerContacts,
  useTourPlannerTasks,
} from '@/lib/tour-planner/hooks'
import { tourPlannerKeys } from '@/lib/tour-planner/keys'
import type { DaySchedule, DealStructure, ShowStatus } from '@/lib/tour-planner/types'
import type { Tour, TourStop } from '@/types'
import {
  CrewPanel,
  DaySheetPdfButton,
  geocodeStopVenue,
  GuestListForm,
  HotelForm,
  ImportPanel,
  LoadInForm,
  MapRoutePanel,
  MerchPanel,
  MerchSettlementForm,
  SettingsPanel,
  SettlementForm,
  VenueContactForm,
} from './TourPlannerExtras'

const DAY_FIELDS = [
  'getIn', 'soundcheck', 'doors', 'stageTime', 'curfew', 'dinnerTime', 'lobbyCall', 'hotelDeparture',
] as const satisfies readonly (keyof DaySchedule)[]

const SHOW_STATUSES: ShowStatus[] = ['option', 'confirmed', 'contract-sent', 'deposit-paid', 'cancelled']

const SHOW_STATUS_I18N: Record<ShowStatus, 'tour_planner_show_status_option' | 'tour_planner_show_status_confirmed' | 'tour_planner_show_status_contract_sent' | 'tour_planner_show_status_deposit_paid' | 'tour_planner_show_status_cancelled'> = {
  option: 'tour_planner_show_status_option',
  confirmed: 'tour_planner_show_status_confirmed',
  'contract-sent': 'tour_planner_show_status_contract_sent',
  'deposit-paid': 'tour_planner_show_status_deposit_paid',
  cancelled: 'tour_planner_show_status_cancelled',
}

const DAY_FIELD_I18N: Record<(typeof DAY_FIELDS)[number], 'tour_planner_day_getIn' | 'tour_planner_day_soundcheck' | 'tour_planner_day_doors' | 'tour_planner_day_stageTime' | 'tour_planner_day_curfew' | 'tour_planner_day_dinnerTime' | 'tour_planner_day_lobbyCall' | 'tour_planner_day_hotelDeparture'> = {
  getIn: 'tour_planner_day_getIn',
  soundcheck: 'tour_planner_day_soundcheck',
  doors: 'tour_planner_day_doors',
  stageTime: 'tour_planner_day_stageTime',
  curfew: 'tour_planner_day_curfew',
  dinnerTime: 'tour_planner_day_dinnerTime',
  lobbyCall: 'tour_planner_day_lobbyCall',
  hotelDeparture: 'tour_planner_day_hotelDeparture',
}

export function TourPlannerTabs({
  artistId,
  activeTour,
  stops,
  onStopsChange,
  onTourChange,
  onTourDeleted,
}: {
  artistId: string
  activeTour: Tour | null
  stops: TourStop[]
  onStopsChange: () => void
  onTourChange: () => void
  onTourDeleted: () => void
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
        <TabsTrigger value="settings">{t('tour_planner_tab_settings')}</TabsTrigger>
      </TabsList>
      <TabsContent value="stops" className="mt-4">
        <StopsPanel artistId={artistId} tourId={activeTour?.id ?? null} stops={stops} onUpdated={onStopsChange} />
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
      <TabsContent value="settings" className="mt-4">
        <SettingsPanel
          artistId={artistId}
          tour={activeTour}
          onSaved={onTourChange}
          onDeleted={onTourDeleted}
        />
      </TabsContent>
    </Tabs>
  )
}

function StopsPanel({
  artistId,
  tourId,
  stops,
  onUpdated,
}: {
  artistId: string
  tourId: string | null
  stops: TourStop[]
  onUpdated: () => void
}) {
  const t = useTranslations('portal')
  if (!stops.length) return <p className="text-sm text-muted-foreground">{t('tour_planner_no_stops')}</p>

  const reorder = async (orderedStopIds: string[]) => {
    if (!tourId) return
    const res = await tourPlannerFetch(artistId, '/stops', {
      method: 'POST',
      body: JSON.stringify({ tourId, orderedStopIds }),
    })
    if (!res.ok) throw new Error('reorder failed')
    onUpdated()
    if (wasQueuedOffline(res)) toast.success(t('tour_planner_saved_offline'))
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= stops.length) return
    const next = [...stops]
    ;[next[index], next[target]] = [next[target], next[index]]
    reorder(next.map((stop) => stop.id)).catch(() => toast.error(t('tour_planner_error')))
  }

  return (
    <ul className="space-y-3">
      {stops.map((stop, index) => (
        <StopCard
          key={stop.id}
          artistId={artistId}
          stop={stop}
          index={index}
          total={stops.length}
          onMoveUp={() => move(index, -1)}
          onMoveDown={() => move(index, 1)}
          onUpdated={onUpdated}
        />
      ))}
    </ul>
  )
}

function StopCard({
  artistId,
  stop,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onUpdated,
}: {
  artistId: string
  stop: TourStop
  index: number
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
  onUpdated: () => void
}) {
  const t = useTranslations('portal')
  const [open, setOpen] = useState<'day' | 'finance' | 'guest' | 'venue' | 'loadin' | 'settlement' | 'merch' | 'hotel' | null>(null)

  const patchStop = async (body: Record<string, unknown>) => {
    const res = await tourPlannerFetch(artistId, `/stops/${stop.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('patch failed')
    onUpdated()
    if (wasQueuedOffline(res)) toast.success(t('tour_planner_saved_offline'))
  }

  const deleteStop = async () => {
    if (!window.confirm(t('tour_planner_delete_stop_confirm'))) return
    const res = await tourPlannerFetch(artistId, `/stops/${stop.id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('delete failed')
    onUpdated()
    toast.success(wasQueuedOffline(res) ? t('tour_planner_saved_offline') : t('tour_planner_stop_deleted'))
  }

  const publishOrSync = () => {
    const body = stop.concertId ? { syncConcert: true } : { publishConcert: true }
    patchStop(body)
      .then(() => toast.success(t('tour_planner_published')))
      .catch(() => toast.error(t('tour_planner_error')))
  }

  return (
    <li className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{stop.venueName ?? t('tour_planner_unnamed_stop')}</p>
          <p className="text-sm text-muted-foreground">
            {stop.stopDate}
            {stop.isTravelDay ? ` · ${t('tour_planner_travel_day_label')}` : ''}
            {stop.venueCity ? ` · ${stop.venueCity}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onMoveUp} disabled={index === 0} aria-label={t('tour_planner_move_up')}>
            <ArrowUp size={16} aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" onClick={onMoveDown} disabled={index >= total - 1} aria-label={t('tour_planner_move_down')}>
            <ArrowDown size={16} aria-hidden />
          </Button>
          <ShowStatusSelect
            value={stop.showStatus}
            onChange={(showStatus) => patchStop({ showStatus }).catch(() => toast.error(t('tour_planner_error')))}
          />
        </div>
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
        <Dialog open={open === 'loadin'} onOpenChange={(v) => setOpen(v ? 'loadin' : null)}>
          <DialogTrigger asChild><Button variant="outline" size="sm">{t('tour_planner_loadin')}</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>{t('tour_planner_loadin')}</DialogTitle></DialogHeader>
            <LoadInForm details={stop.venueDetails} onSave={(venueDetails) => patchStop({ venueDetails }).then(() => { setOpen(null); toast.success(t('tour_planner_saved')) }).catch(() => toast.error(t('tour_planner_error')))} />
          </DialogContent>
        </Dialog>
        <Dialog open={open === 'hotel'} onOpenChange={(v) => setOpen(v ? 'hotel' : null)}>
          <DialogTrigger asChild><Button variant="outline" size="sm">{t('tour_planner_hotel_name')}</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>{t('tour_planner_hotel_name')}</DialogTitle></DialogHeader>
            <HotelForm
              stop={stop}
              onSave={(fields) => patchStop(fields).then(() => { setOpen(null); toast.success(t('tour_planner_saved')) }).catch(() => toast.error(t('tour_planner_error')))}
            />
          </DialogContent>
        </Dialog>
        <Dialog open={open === 'settlement'} onOpenChange={(v) => setOpen(v ? 'settlement' : null)}>
          <DialogTrigger asChild><Button variant="outline" size="sm">{t('tour_planner_settlement')}</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>{t('tour_planner_settlement')}</DialogTitle></DialogHeader>
            <SettlementForm
              stop={stop}
              settlement={stop.settlement}
              deal={stop.deal}
              onSave={(settlement) => patchStop({ settlement }).then(() => { setOpen(null); toast.success(t('tour_planner_saved')) }).catch(() => toast.error(t('tour_planner_error')))}
            />
          </DialogContent>
        </Dialog>
        <Dialog open={open === 'merch'} onOpenChange={(v) => setOpen(v ? 'merch' : null)}>
          <DialogTrigger asChild><Button variant="outline" size="sm">{t('tour_planner_merch_settlement')}</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>{t('tour_planner_merch_settlement')}</DialogTitle></DialogHeader>
            <MerchSettlementForm artistId={artistId} stop={stop} onSaved={() => { setOpen(null); toast.success(t('tour_planner_saved')) }} />
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="sm" onClick={async () => {
          const c = await geocodeStopVenue(artistId, stop)
          if (!c) { toast.error(t('tour_planner_geocode_fail')); return }
          patchStop({ venueLat: c.lat, venueLng: c.lng, venueValidated: true }).then(() => toast.success(t('tour_planner_geocode_ok'))).catch(() => toast.error(t('tour_planner_error')))
        }}>{t('tour_planner_geocode')}</Button>
        <Button variant="outline" size="sm" onClick={publishOrSync}>
          {stop.concertId ? t('tour_planner_sync_event') : t('tour_planner_publish_event')}
        </Button>
        <DaySheetPdfButton stop={stop} />
        <Button variant="ghost" size="sm" onClick={() => deleteStop().catch(() => toast.error(t('tour_planner_error')))} aria-label={t('tour_planner_delete_stop')}>
          <Trash size={16} aria-hidden />
          {t('tour_planner_delete_stop')}
        </Button>
      </div>
    </li>
  )
}

function ShowStatusSelect({ value, onChange }: { value: ShowStatus; onChange: (v: ShowStatus) => void }) {
  const t = useTranslations('portal')
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ShowStatus)}>
      <SelectTrigger className="w-[180px]" aria-label={t('tour_planner_show_status_label')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SHOW_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>{t(SHOW_STATUS_I18N[status])}</SelectItem>
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
          <Label htmlFor={field}>{t(DAY_FIELD_I18N[field])}</Label>
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
            <SelectItem value="guarantee">{t('tour_planner_deal_guarantee')}</SelectItem>
            <SelectItem value="door-split">{t('tour_planner_deal_door_split')}</SelectItem>
            <SelectItem value="versus">{t('tour_planner_deal_versus')}</SelectItem>
            <SelectItem value="bonus">{t('tour_planner_deal_bonus')}</SelectItem>
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
  const { data: tasks = [] } = useTourPlannerTasks(artistId)
  const create = useMutation({
    mutationFn: async () => {
      const res = await tourPlannerFetch(artistId, '/tasks', {
        method: 'POST',
        body: JSON.stringify({ title, dueDate, tourId }),
      })
      if (!res.ok) throw new Error('create task')
      return wasQueuedOffline(res)
    },
    onSuccess: (offline) => {
      void qc.invalidateQueries({ queryKey: tourPlannerKeys.tasks(artistId) })
      setTitle('')
      setDueDate('')
      if (offline) toast.success(t('tour_planner_saved_offline'))
    },
  })

  const toggleTask = async (taskId: string, completed: boolean) => {
    const res = await tourPlannerFetch(artistId, `/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: !completed }),
    })
    if (!res.ok) throw new Error('toggle task')
    void qc.invalidateQueries({ queryKey: tourPlannerKeys.tasks(artistId) })
  }

  const deleteTask = async (taskId: string) => {
    const res = await tourPlannerFetch(artistId, `/tasks/${taskId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('delete task')
    void qc.invalidateQueries({ queryKey: tourPlannerKeys.tasks(artistId) })
    toast.success(wasQueuedOffline(res) ? t('tour_planner_saved_offline') : t('tour_planner_task_deleted'))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input placeholder={t('tour_planner_task_title')} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label={t('tour_planner_task_due')} />
        <Button disabled={!title || !dueDate} onClick={() => create.mutate()}>{t('tour_planner_add_task')}</Button>
      </div>
      <ul className="divide-y divide-border rounded-md border">
        {tasks.map((task) => (
          <li key={task.id} className="p-3 text-sm flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 min-w-0">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleTask(task.id, task.completed).catch(() => toast.error(t('tour_planner_error')))}
              />
              <span className={task.completed ? 'line-through text-muted-foreground' : ''}>{task.title}</span>
            </label>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-muted-foreground">{task.dueDate}</span>
              <Button variant="ghost" size="sm" onClick={() => deleteTask(task.id).catch(() => toast.error(t('tour_planner_error')))} aria-label={t('tour_planner_delete_task')}>
                <Trash size={14} aria-hidden />
              </Button>
            </div>
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
  const { data: contacts = [] } = useTourPlannerContacts(artistId)
  const create = useMutation({
    mutationFn: async () => {
      const res = await tourPlannerFetch(artistId, '/contacts', { method: 'POST', body: JSON.stringify({ name }) })
      if (!res.ok) throw new Error('create contact')
      return wasQueuedOffline(res)
    },
    onSuccess: (offline) => {
      void qc.invalidateQueries({ queryKey: tourPlannerKeys.contacts(artistId) })
      setName('')
      if (offline) toast.success(t('tour_planner_saved_offline'))
    },
  })

  const deleteContact = async (contactId: string) => {
    const res = await tourPlannerFetch(artistId, `/contacts/${contactId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('delete contact')
    void qc.invalidateQueries({ queryKey: tourPlannerKeys.contacts(artistId) })
    toast.success(wasQueuedOffline(res) ? t('tour_planner_saved_offline') : t('tour_planner_contact_deleted'))
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder={t('tour_planner_contact_name')} value={name} onChange={(e) => setName(e.target.value)} />
        <Button disabled={!name} onClick={() => create.mutate()}>{t('tour_planner_add_contact')}</Button>
      </div>
      <ul className="divide-y divide-border rounded-md border">
        {contacts.map((c) => (
          <li key={c.id} className="p-3 text-sm flex items-center justify-between gap-2">
            <span>{c.name}{c.company ? ` · ${c.company}` : ''}</span>
            <Button variant="ghost" size="sm" onClick={() => deleteContact(c.id).catch(() => toast.error(t('tour_planner_error')))} aria-label={t('tour_planner_delete_contact')}>
              <Trash size={14} aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}