'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  CalendarBlank,
  CurrencyEur,
  LinkSimple,
  MegaphoneSimple,
  Spinner,
  Trash,
} from '@phosphor-icons/react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { createPromoLogEntry, deletePromoLogEntry, type PromoLogInsert } from '@/lib/api/promoLog'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Artist, PromoLogEntry } from '@/types'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const

interface PromoLogAdminProps {
  artists: Artist[]
  activeArtistId: string | null
  initialEntries: PromoLogEntry[]
}

function getDefaultActionDate(): string {
  return new Date().toISOString().split('T')[0] ?? ''
}

function formatBudget(amount: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(date: string): string {
  try {
    return format(parseISO(date), 'dd.MM.yyyy')
  } catch {
    return date
  }
}

interface PromoEntryCardProps {
  entry: PromoLogEntry
  isDeleting: boolean
  onDelete: (id: string) => Promise<void>
}

function PromoEntryCard({ entry, isDeleting, onDelete }: PromoEntryCardProps) {
  return (
    <li className="relative pl-8 pb-8 last:pb-0">
      <span
        className="absolute left-0 top-3 flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-primary/20"
        aria-hidden="true"
      >
        <MegaphoneSimple size={12} weight="bold" className="text-primary" />
      </span>
      <Card className="border-border bg-card">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <time
                dateTime={entry.actionDate}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground"
              >
                <CalendarBlank size={13} aria-hidden="true" />
                {formatDate(entry.actionDate)}
              </time>
              {entry.budgetAmount != null && entry.budgetAmount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  <CurrencyEur size={12} aria-hidden="true" />
                  {formatBudget(entry.budgetAmount, entry.budgetCurrency)}
                </span>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void onDelete(entry.id)}
              disabled={isDeleting}
              className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={`Delete promo log entry from ${formatDate(entry.actionDate)}`}
            >
              {isDeleting ? (
                <Spinner size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash size={16} aria-hidden="true" />
              )}
            </Button>
          </div>

          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{entry.description}</p>

          {entry.proofUrl && (
            <a
              href={entry.proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label={`Open proof URL for ${entry.description}`}
            >
              <LinkSimple size={16} aria-hidden="true" />
              View proof
            </a>
          )}
        </CardContent>
      </Card>
    </li>
  )
}

export function PromoLogAdmin({ artists, activeArtistId, initialEntries }: PromoLogAdminProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [actionDate, setActionDate] = useState(getDefaultActionDate)
  const [description, setDescription] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetCurrency, setBudgetCurrency] = useState<(typeof CURRENCIES)[number]>('EUR')
  const [proofUrl, setProofUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const activeArtist = artists.find((artist) => artist.id === activeArtistId) ?? null

  async function handleArtistChange(artistId: string) {
    const params = new URLSearchParams()
    params.set('artistId', artistId)
    router.push(`${pathname}?${params.toString()}`)
    router.refresh()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!activeArtistId) {
      toast.error('Please select an artist first.')
      return
    }

    const trimmedDescription = description.trim()
    const trimmedProofUrl = proofUrl.trim()

    if (!actionDate || !trimmedDescription) {
      toast.error('Action date and description are required.')
      return
    }

    const parsedBudget = budgetAmount.trim() ? Number.parseFloat(budgetAmount.replace(',', '.')) : null
    if (parsedBudget != null && (!Number.isFinite(parsedBudget) || parsedBudget < 0)) {
      toast.error('Please enter a valid budget amount.')
      return
    }

    setIsSaving(true)

    try {
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      if (!data.user) throw new Error('You must be signed in to create promo log entries.')

      const payload: PromoLogInsert = {
        artist_id: activeArtistId,
        action_date: actionDate,
        description: trimmedDescription,
        budget_currency: budgetCurrency,
        proof_url: trimmedProofUrl || null,
        proof_r2_key: null,
        created_by: data.user.id,
      }

      if (parsedBudget != null) {
        payload.budget_amount = parsedBudget
      }

      await createPromoLogEntry(supabase, payload)

      setActionDate(getDefaultActionDate())
      setDescription('')
      setBudgetAmount('')
      setBudgetCurrency('EUR')
      setProofUrl('')
      toast.success('Promo log entry created.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create promo log entry.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this marketing activity?')) return

    setDeletingId(id)

    try {
      await deletePromoLogEntry(supabase, id)
      toast.success('Promo log entry deleted.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete promo log entry.')
    } finally {
      setDeletingId(null)
    }
  }

  if (artists.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MegaphoneSimple size={20} aria-hidden="true" />
            Promo Log
          </CardTitle>
          <CardDescription>No artists are available yet. Add an artist before creating marketing activities.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Promo Log</h1>
        <p className="text-sm text-muted-foreground">
          Document label marketing work per artist and keep the portal timeline up to date.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Artist</CardTitle>
          <CardDescription>Select which artist&apos;s promo timeline you want to manage.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="promo-log-artist-select">Artist</Label>
            <Select value={activeArtistId ?? undefined} onValueChange={(value) => void handleArtistChange(value)}>
              <SelectTrigger
                id="promo-log-artist-select"
                aria-label="Select artist"
                className="min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <SelectValue placeholder="Select artist" />
              </SelectTrigger>
              <SelectContent>
                {artists.map((artist) => (
                  <SelectItem key={artist.id} value={artist.id}>
                    {artist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>New Entry{activeArtist ? ` — ${activeArtist.name}` : ''}</CardTitle>
          <CardDescription>Create a new marketing activity for the selected artist.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="promo-log-action-date">Action Date</Label>
                <Input
                  id="promo-log-action-date"
                  type="date"
                  required
                  value={actionDate}
                  onChange={(event) => setActionDate(event.target.value)}
                  className="min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="promo-log-description">Description</Label>
                <Textarea
                  id="promo-log-description"
                  required
                  rows={4}
                  maxLength={1000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe the marketing activity carried out for this artist."
                  className="focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
              <div className="space-y-2">
                <Label htmlFor="promo-log-budget-amount">Budget Amount</Label>
                <Input
                  id="promo-log-budget-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={budgetAmount}
                  onChange={(event) => setBudgetAmount(event.target.value)}
                  placeholder="0.00"
                  className="min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="promo-log-budget-currency">Budget Currency</Label>
                <Select
                  value={budgetCurrency}
                  onValueChange={(value) => setBudgetCurrency(value as (typeof CURRENCIES)[number])}
                >
                  <SelectTrigger
                    id="promo-log-budget-currency"
                    aria-label="Budget currency"
                    className="min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="promo-log-proof-url">Proof URL</Label>
              <Input
                id="promo-log-proof-url"
                type="url"
                inputMode="url"
                value={proofUrl}
                onChange={(event) => setProofUrl(event.target.value)}
                placeholder="https://example.com/proof"
                className="min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              />
            </div>

            <Button
              type="submit"
              disabled={isSaving}
              className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {isSaving ? (
                <>
                  <Spinner size={16} className="mr-2 animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                'Create entry'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="promo-log-entries-heading" className="space-y-3">
        <div className="space-y-1">
          <h2 id="promo-log-entries-heading" className="text-lg font-semibold">
            Existing Entries
          </h2>
          <p className="text-sm text-muted-foreground">
            {activeArtist ? `Timeline entries currently visible to ${activeArtist.name} in the portal.` : 'No artist selected.'}
          </p>
        </div>

        {initialEntries.length === 0 ? (
          <Card className="border-dashed border-border bg-card">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No marketing activities have been logged for this artist yet.
            </CardContent>
          </Card>
        ) : (
          <ol className="space-y-0" aria-label={`${activeArtist?.name ?? 'Selected artist'} promo log entries`}>
            {initialEntries.map((entry) => (
              <PromoEntryCard
                key={entry.id}
                entry={entry}
                isDeleting={deletingId === entry.id}
                onDelete={handleDelete}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
