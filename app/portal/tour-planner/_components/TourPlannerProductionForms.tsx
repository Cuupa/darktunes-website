'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { DownloadSimple, Trash, UploadSimple } from '@phosphor-icons/react'
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
import { tourPlannerToken } from '@/lib/tour-planner/clientApi'
import type {
  Currency,
  DealStructure,
  PerDiem,
  RoomingAssignment,
  TechDocument,
  TourBudget,
  TourBudgetCategory,
  TourBudgetLine,
  TravelManifest,
} from '@/lib/tour-planner/types'
import { EMPTY_TOUR_BUDGET } from '@/lib/tour-planner/types'
import type { TourContact } from '@/types'

const CURRENCIES = ['EUR', 'GBP', 'USD', 'CHF'] as const satisfies readonly Currency[]

const TECH_DOC_TYPES = [
  'tech-rider',
  'stage-plot',
  'input-list',
  'catering-rider',
  'other',
] as const satisfies readonly TechDocument['type'][]

const BUDGET_CATEGORIES = [
  'transport',
  'accommodation',
  'crew',
  'production',
  'marketing',
  'merch',
  'other',
] as const satisfies readonly TourBudgetCategory[]

type TechDocType = (typeof TECH_DOC_TYPES)[number]
type BudgetCategory = (typeof BUDGET_CATEGORIES)[number]

const TECH_DOC_I18N: Record<TechDocType, 'tour_planner_tech_rider' | 'tour_planner_tech_stage_plot' | 'tour_planner_tech_input_list' | 'tour_planner_tech_catering' | 'tour_planner_tech_other'> = {
  'tech-rider': 'tour_planner_tech_rider',
  'stage-plot': 'tour_planner_tech_stage_plot',
  'input-list': 'tour_planner_tech_input_list',
  'catering-rider': 'tour_planner_tech_catering',
  other: 'tour_planner_tech_other',
}

const BUDGET_CATEGORY_I18N: Record<BudgetCategory, 'tour_planner_budget_transport' | 'tour_planner_budget_accommodation' | 'tour_planner_budget_crew' | 'tour_planner_budget_production' | 'tour_planner_budget_marketing' | 'tour_planner_budget_merch' | 'tour_planner_budget_other'> = {
  transport: 'tour_planner_budget_transport',
  accommodation: 'tour_planner_budget_accommodation',
  crew: 'tour_planner_budget_crew',
  production: 'tour_planner_budget_production',
  marketing: 'tour_planner_budget_marketing',
  merch: 'tour_planner_budget_merch',
  other: 'tour_planner_budget_other',
}

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

export function TechDocumentsForm({
  artistId,
  tourId,
  documents,
  onSave,
}: {
  artistId: string
  tourId: string
  documents: TechDocument[]
  onSave: (docs: TechDocument[]) => void
}) {
  const t = useTranslations('portal')
  const fileRef = useRef<HTMLInputElement>(null)
  const [list, setList] = useState<TechDocument[]>(documents)
  const [name, setName] = useState('')
  const [docType, setDocType] = useState<TechDocType>('tech-rider')
  const [uploading, setUploading] = useState(false)

  const uploadFile = async (file: File) => {
    if (!name.trim()) {
      toast.error(t('tour_planner_tech_name_required'))
      return
    }
    setUploading(true)
    try {
      const token = await tourPlannerToken()
      const form = new FormData()
      form.append('file', file)
      form.append('tourId', tourId)
      const res = await fetch(
        `/api/portal/tour-planner/tech-documents/upload?artistId=${encodeURIComponent(artistId)}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        },
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(err?.error ?? t('tour_planner_error'))
      }
      const json = (await res.json()) as { url: string }
      const doc: TechDocument = {
        id: crypto.randomUUID(),
        name: name.trim(),
        type: docType,
        url: json.url,
        uploadedAt: new Date().toISOString(),
      }
      setList((prev) => [...prev, doc])
      setName('')
      if (fileRef.current) fileRef.current.value = ''
      toast.success(t('tour_planner_tech_uploaded'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('tour_planner_error'))
    } finally {
      setUploading(false)
    }
  }

  const removeDoc = (id: string) => setList((prev) => prev.filter((d) => d.id !== id))

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border rounded-md border">
        {list.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">{t('tour_planner_tech_empty')}</li>
        ) : list.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-2 p-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium truncate">{doc.name}</p>
              <p className="text-muted-foreground">{t(TECH_DOC_I18N[doc.type])}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {doc.url && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" aria-label={t('tour_planner_tech_download')}>
                    <DownloadSimple size={14} aria-hidden />
                  </a>
                </Button>
              )}
              <Button variant="ghost" size="sm" aria-label={t('tour_planner_remove')} onClick={() => removeDoc(doc.id)}>
                <Trash size={14} aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="tech-doc-name">{t('tour_planner_tech_name')}</Label>
          <Input id="tech-doc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('tour_planner_tech_name_placeholder')} />
        </div>
        <div className="space-y-1">
          <Label>{t('tour_planner_tech_type')}</Label>
          <Select value={docType} onValueChange={(v) => setDocType(v as TechDocType)}>
            <SelectTrigger aria-label={t('tour_planner_tech_type')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TECH_DOC_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{t(TECH_DOC_I18N[type])}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void uploadFile(file)
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={uploading || !name.trim()} onClick={() => fileRef.current?.click()}>
          <UploadSimple size={16} aria-hidden />
          {uploading ? t('tour_planner_tech_uploading') : t('tour_planner_tech_upload')}
        </Button>
        <Button onClick={() => onSave(list)}>{t('tour_planner_save')}</Button>
      </div>
    </div>
  )
}

export function BudgetForm({
  budget,
  currency,
  totalBudget,
  onSave,
}: {
  budget: TourBudget | null
  currency: string
  totalBudget: number | null
  onSave: (data: { budget: TourBudget; totalBudget: number | null; currency: string }) => void
}) {
  const t = useTranslations('portal')
  const [draft, setDraft] = useState<TourBudget>(budget ?? EMPTY_TOUR_BUDGET)
  const [total, setTotal] = useState<number | null>(totalBudget)
  const [curr, setCurr] = useState(currency)
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<BudgetCategory>('transport')
  const [planned, setPlanned] = useState(0)

  const plannedSum = draft.lines.reduce((sum, line) => sum + line.planned, 0)
  const actualSum = draft.lines.reduce((sum, line) => sum + (line.actual ?? 0), 0)

  const addLine = () => {
    if (!label.trim()) return
    const line: TourBudgetLine = {
      id: crypto.randomUUID(),
      category,
      label: label.trim(),
      planned,
    }
    setDraft({ ...draft, lines: [...draft.lines, line] })
    setLabel('')
    setPlanned(0)
  }

  const removeLine = (id: string) => {
    setDraft({ ...draft, lines: draft.lines.filter((line) => line.id !== id) })
  }

  const updateActual = (id: string, actual: number) => {
    setDraft({
      ...draft,
      lines: draft.lines.map((line) => (line.id === id ? { ...line, actual } : line)),
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 max-w-md">
        <div className="space-y-1">
          <Label htmlFor="budget-total">{t('tour_planner_total_budget')}</Label>
          <Input
            id="budget-total"
            type="number"
            value={total ?? ''}
            onChange={(e) => setTotal(e.target.value ? Number(e.target.value) : null)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="budget-currency">{t('tour_planner_currency')}</Label>
          <Select value={curr} onValueChange={setCurr}>
            <SelectTrigger id="budget-currency" aria-label={t('tour_planner_currency')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {draft.lines.length > 0 && (
        <div className="rounded-md border divide-y divide-border">
          {draft.lines.map((line) => (
            <div key={line.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto_auto_auto] items-end text-sm">
              <div>
                <p className="font-medium">{line.label}</p>
                <p className="text-muted-foreground">{t(BUDGET_CATEGORY_I18N[line.category])} · {line.planned} {curr}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('tour_planner_budget_actual')}</Label>
                <Input
                  type="number"
                  className="w-28"
                  value={line.actual ?? ''}
                  onChange={(e) => updateActual(line.id, Number(e.target.value))}
                />
              </div>
              <Button variant="ghost" size="sm" aria-label={t('tour_planner_remove')} onClick={() => removeLine(line.id)}>
                <Trash size={14} aria-hidden />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-4 items-end">
        <Input placeholder={t('tour_planner_budget_label')} value={label} onChange={(e) => setLabel(e.target.value)} className="sm:col-span-2" />
        <Select value={category} onValueChange={(v) => setCategory(v as BudgetCategory)}>
          <SelectTrigger aria-label={t('tour_planner_budget_category')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUDGET_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{t(BUDGET_CATEGORY_I18N[cat])}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="number" placeholder={t('tour_planner_amount')} value={planned} onChange={(e) => setPlanned(Number(e.target.value))} aria-label={t('tour_planner_amount')} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={addLine} disabled={!label.trim()}>{t('tour_planner_add')}</Button>
        <Button onClick={() => onSave({ budget: draft, totalBudget: total, currency: curr })}>{t('tour_planner_save')}</Button>
      </div>
      {draft.lines.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t('tour_planner_budget_summary', { planned: plannedSum, actual: actualSum, currency: curr })}
        </p>
      )}
    </div>
  )
}