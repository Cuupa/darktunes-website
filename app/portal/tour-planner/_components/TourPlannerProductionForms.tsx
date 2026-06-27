'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Trash } from '@phosphor-icons/react'
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
import { Textarea } from '@/components/ui/textarea'
import type {
  Currency,
  DealStructure,
  PerDiem,
  RoomingAssignment,
  TravelManifest,
} from '@/lib/tour-planner/types'
import type { TourContact } from '@/types'

const CURRENCIES = ['EUR', 'GBP', 'USD', 'CHF'] as const satisfies readonly Currency[]

export function FinanceForm({ deal, onSave }: { deal: DealStructure | null; onSave: (d: DealStructure) => void }) {
  const t = useTranslations('portal')
  const [draft, setDraft] = useState<DealStructure>(deal ?? { type: 'guarantee', currency: 'EUR', guarantee: 0 })
  const num = (key: keyof DealStructure, value: string) => setDraft({ ...draft, [key]: Number(value) })

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
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
        <Label>{t('tour_planner_currency')}</Label>
        <Select value={draft.currency} onValueChange={(currency) => setDraft({ ...draft, currency: currency as Currency })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>{t('tour_planner_guarantee')}</Label>
        <Input type="number" value={draft.guarantee ?? 0} onChange={(e) => num('guarantee', e.target.value)} />
      </div>
      {(draft.type === 'door-split' || draft.type === 'versus') && (
        <div className="space-y-1">
          <Label>{t('tour_planner_door_split_pct')}</Label>
          <Input type="number" value={draft.doorSplitPercentage ?? 0} onChange={(e) => num('doorSplitPercentage', e.target.value)} />
        </div>
      )}
      {draft.type === 'versus' && (
        <>
          <div className="space-y-1">
            <Label>{t('tour_planner_versus_amount')}</Label>
            <Input type="number" value={draft.versusAmount ?? 0} onChange={(e) => num('versusAmount', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t('tour_planner_versus_pct')}</Label>
            <Input type="number" value={draft.versusPercentage ?? 0} onChange={(e) => num('versusPercentage', e.target.value)} />
          </div>
        </>
      )}
      {draft.type === 'bonus' && (
        <>
          <div className="space-y-1">
            <Label>{t('tour_planner_bonus_threshold')}</Label>
            <Input type="number" value={draft.bonusThreshold ?? 0} onChange={(e) => num('bonusThreshold', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t('tour_planner_bonus_amount')}</Label>
            <Input type="number" value={draft.bonusAmount ?? 0} onChange={(e) => num('bonusAmount', e.target.value)} />
          </div>
        </>
      )}
      <div className="space-y-1">
        <Label>{t('tour_planner_withholding_tax')}</Label>
        <Input type="number" value={draft.withholdingTax ?? 0} onChange={(e) => num('withholdingTax', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>{t('tour_planner_promoter_costs')}</Label>
        <Input type="number" value={draft.promoterCosts ?? 0} onChange={(e) => num('promoterCosts', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>{t('tour_planner_break_even')}</Label>
        <Input type="number" value={draft.breakEvenPoint ?? 0} onChange={(e) => num('breakEvenPoint', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>{t('tour_planner_withholding_country')}</Label>
        <Input value={draft.withholdingTaxCountry ?? ''} onChange={(e) => setDraft({ ...draft, withholdingTaxCountry: e.target.value })} />
      </div>
      <Button className="sm:col-span-2" onClick={() => onSave(draft)}>{t('tour_planner_save')}</Button>
    </div>
  )
}

export function PerDiemsForm({ items, onSave }: { items: PerDiem[]; onSave: (items: PerDiem[]) => void }) {
  const t = useTranslations('portal')
  const [list, setList] = useState<PerDiem[]>(items)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState('')

  const add = () => {
    if (!name || !date) return
    setList([...list, {
      personId: crypto.randomUUID(),
      personName: name,
      amount,
      currency: 'EUR',
      date,
      paid: false,
    }])
    setName('')
    setAmount(0)
    setDate('')
  }

  return (
    <div className="space-y-3">
      <ul className="text-sm space-y-2 divide-y divide-border">
        {list.map((item) => (
          <li key={item.personId} className="flex items-center justify-between gap-2 pt-2">
            <span>{item.personName} · {item.date} · {item.amount} {item.currency}</span>
            <Button variant="ghost" size="sm" aria-label={t('tour_planner_remove')} onClick={() => setList(list.filter((x) => x.personId !== item.personId))}>
              <Trash size={14} aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder={t('tour_planner_person_name')} value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="number" placeholder={t('tour_planner_amount')} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t('tour_planner_stop_date')} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={add}>{t('tour_planner_add')}</Button>
        <Button onClick={() => onSave(list)}>{t('tour_planner_save')}</Button>
      </div>
    </div>
  )
}

export function RoomingForm({ items, onSave }: { items: RoomingAssignment[]; onSave: (items: RoomingAssignment[]) => void }) {
  const t = useTranslations('portal')
  const [list, setList] = useState<RoomingAssignment[]>(items)
  const [name, setName] = useState('')
  const [roomType, setRoomType] = useState<RoomingAssignment['roomType']>('twin')
  const [roomNumber, setRoomNumber] = useState('')

  const add = () => {
    if (!name) return
    setList([...list, { personId: crypto.randomUUID(), personName: name, roomType, roomNumber: roomNumber || undefined }])
    setName('')
    setRoomNumber('')
  }

  return (
    <div className="space-y-3">
      <ul className="text-sm space-y-2 divide-y divide-border">
        {list.map((item) => (
          <li key={item.personId} className="flex items-center justify-between gap-2 pt-2">
            <span>{item.personName} · {item.roomType}{item.roomNumber ? ` #${item.roomNumber}` : ''}</span>
            <Button variant="ghost" size="sm" aria-label={t('tour_planner_remove')} onClick={() => setList(list.filter((x) => x.personId !== item.personId))}>
              <Trash size={14} aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder={t('tour_planner_person_name')} value={name} onChange={(e) => setName(e.target.value)} />
        <Select value={roomType} onValueChange={(v) => setRoomType(v as RoomingAssignment['roomType'])}>
          <SelectTrigger aria-label={t('tour_planner_room_type')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="single">{t('tour_planner_room_single')}</SelectItem>
            <SelectItem value="twin">{t('tour_planner_room_twin')}</SelectItem>
            <SelectItem value="suite">{t('tour_planner_room_suite')}</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder={t('tour_planner_room_number')} value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={add}>{t('tour_planner_add')}</Button>
        <Button onClick={() => onSave(list)}>{t('tour_planner_save')}</Button>
      </div>
    </div>
  )
}

export function TravelManifestForm({ items, onSave }: { items: TravelManifest[]; onSave: (items: TravelManifest[]) => void }) {
  const t = useTranslations('portal')
  const [list, setList] = useState<TravelManifest[]>(items)
  const [name, setName] = useState('')
  const [vehicle, setVehicle] = useState<TravelManifest['vehicle']>('bus')
  const [seat, setSeat] = useState('')

  const add = () => {
    if (!name) return
    setList([...list, {
      personId: crypto.randomUUID(),
      personName: name,
      vehicle,
      seatNumber: seat || undefined,
    }])
    setName('')
    setSeat('')
  }

  return (
    <div className="space-y-3">
      <ul className="text-sm space-y-2 divide-y divide-border">
        {list.map((item) => (
          <li key={item.personId} className="flex items-center justify-between gap-2 pt-2">
            <span>{item.personName} · {item.vehicle}{item.seatNumber ? ` · ${item.seatNumber}` : ''}</span>
            <Button variant="ghost" size="sm" aria-label={t('tour_planner_remove')} onClick={() => setList(list.filter((x) => x.personId !== item.personId))}>
              <Trash size={14} aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder={t('tour_planner_person_name')} value={name} onChange={(e) => setName(e.target.value)} />
        <Select value={vehicle} onValueChange={(v) => setVehicle(v as TravelManifest['vehicle'])}>
          <SelectTrigger aria-label={t('tour_planner_vehicle')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bus">{t('tour_planner_vehicle_bus')}</SelectItem>
            <SelectItem value="van">{t('tour_planner_vehicle_van')}</SelectItem>
            <SelectItem value="flight">{t('tour_planner_vehicle_flight')}</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder={t('tour_planner_seat')} value={seat} onChange={(e) => setSeat(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={add}>{t('tour_planner_add')}</Button>
        <Button onClick={() => onSave(list)}>{t('tour_planner_save')}</Button>
      </div>
    </div>
  )
}

export function ContactForm({
  contact,
  onSave,
}: {
  contact: Partial<TourContact> & { name: string }
  onSave: (data: Record<string, unknown>) => void
}) {
  const t = useTranslations('portal')
  const [draft, setDraft] = useState({
    name: contact.name,
    company: contact.company ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    contactType: contact.contactType ?? 'promoter',
    notes: contact.notes ?? '',
  })

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
        <Label>{t('tour_planner_contact_name')}</Label>
        <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>{t('tour_planner_contact_company')}</Label>
        <Input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>{t('tour_planner_contact_type')}</Label>
        <Input value={draft.contactType} onChange={(e) => setDraft({ ...draft, contactType: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>{t('tour_planner_contact_email')}</Label>
        <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>{t('tour_planner_contact_phone')}</Label>
        <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label>{t('tour_planner_notes')}</Label>
        <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
      </div>
      <Button className="sm:col-span-2" onClick={() => onSave({
        name: draft.name,
        company: draft.company || null,
        email: draft.email || null,
        phone: draft.phone || null,
        contactType: draft.contactType,
        notes: draft.notes || null,
      })}>
        {t('tour_planner_save')}
      </Button>
    </div>
  )
}