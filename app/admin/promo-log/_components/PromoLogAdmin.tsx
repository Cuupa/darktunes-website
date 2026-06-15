'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  CalendarBlank,
  Camera,
  CurrencyEur,
  Image as ImageIcon,
  LinkSimple,
  MegaphoneSimple,
  PencilSimple,
  Spinner,
  Trash,
  X,
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
import {
  createPromoLogEntry,
  updatePromoLogEntry,
  deletePromoLogEntry,
  type PromoLogInsert,
} from '@/lib/api/promoLog'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
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
  onEdit: (entry: PromoLogEntry) => void
  onDelete: (id: string) => Promise<void>
}

function PromoEntryCard({ entry, isDeleting, onEdit, onDelete }: PromoEntryCardProps) {
  const thumbUrl = entry.proofUrl ? getOptimizedImageUrl(entry.proofUrl, 400) : null

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

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onEdit(entry)}
                className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={`Edit promo log entry from ${formatDate(entry.actionDate)}`}
              >
                <PencilSimple size={16} aria-hidden="true" />
              </Button>
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
          </div>

          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{entry.description}</p>

          {thumbUrl && (
            <a
              href={entry.proofUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-md border border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label={`View proof screenshot for ${entry.description}`}
            >
              <Image
                src={thumbUrl}
                alt={`Proof screenshot — ${entry.description}`}
                width={640}
                height={360}
                className="h-auto w-full max-h-48 object-cover"
                unoptimized
              />
            </a>
          )}

          {!thumbUrl && entry.proofUrl && (
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

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionDate, setActionDate] = useState(getDefaultActionDate)
  const [description, setDescription] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetCurrency, setBudgetCurrency] = useState<(typeof CURRENCIES)[number]>('EUR')

  // Proof image state
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [proofR2Key, setProofR2Key] = useState<string | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const formRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeArtist = artists.find((artist) => artist.id === activeArtistId) ?? null

  // ---------------------------------------------------------------------------
  // Clipboard paste — extract image blob and upload to R2
  // ---------------------------------------------------------------------------
  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      if (!activeArtistId) return
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageItem = items.find((item) => item.type.startsWith('image/'))
      if (!imageItem) return
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (!file) return
      await uploadProofFile(file)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeArtistId],
  )

  useEffect(() => {
    const el = formRef.current
    if (!el) return
    const listener = (e: Event) => void handlePaste(e as ClipboardEvent)
    el.addEventListener('paste', listener)
    return () => el.removeEventListener('paste', listener)
  }, [handlePaste])

  // ---------------------------------------------------------------------------
  // Upload proof image to R2
  // ---------------------------------------------------------------------------
  async function uploadProofFile(file: File) {
    if (!activeArtistId) return
    setUploadingProof(true)
    const localPreview = URL.createObjectURL(file)
    setProofPreview(localPreview)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const body = new FormData()
      body.append('file', file)
      body.append('artistId', activeArtistId)

      const res = await fetch('/api/admin/promo-log/upload-proof', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token },
        body,
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? 'Upload failed')
      }

      const { url, r2Key } = (await res.json()) as { url: string; r2Key: string }
      setProofUrl(url)
      setProofR2Key(r2Key)
      URL.revokeObjectURL(localPreview)
      setProofPreview(url)
      toast.success('Screenshot uploaded.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Proof upload failed')
      URL.revokeObjectURL(localPreview)
      setProofPreview(null)
      setProofUrl(null)
      setProofR2Key(null)
    } finally {
      setUploadingProof(false)
    }
  }

  function removeProof() {
    setProofUrl(null)
    setProofR2Key(null)
    setProofPreview(null)
  }

  // ---------------------------------------------------------------------------
  // Artist selector
  // ---------------------------------------------------------------------------
  async function handleArtistChange(artistId: string) {
    const params = new URLSearchParams()
    params.set('artistId', artistId)
    router.push(`${pathname}?${params.toString()}`)
    router.refresh()
  }

  // ---------------------------------------------------------------------------
  // Edit an existing entry (populate form)
  // ---------------------------------------------------------------------------
  function handleEdit(entry: PromoLogEntry) {
    setEditingId(entry.id)
    setActionDate(entry.actionDate)
    setDescription(entry.description)
    setBudgetAmount(entry.budgetAmount != null ? String(entry.budgetAmount) : '')
    setBudgetCurrency((entry.budgetCurrency as (typeof CURRENCIES)[number]) ?? 'EUR')
    setProofUrl(entry.proofUrl ?? null)
    setProofR2Key(entry.proofR2Key ?? null)
    setProofPreview(entry.proofUrl ?? null)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleCancelEdit() {
    setEditingId(null)
    setActionDate(getDefaultActionDate())
    setDescription('')
    setBudgetAmount('')
    setBudgetCurrency('EUR')
    setProofUrl(null)
    setProofR2Key(null)
    setProofPreview(null)
  }

  // ---------------------------------------------------------------------------
  // Submit: create or update
  // ---------------------------------------------------------------------------
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!activeArtistId) {
      toast.error('Please select an artist first.')
      return
    }

    const trimmedDescription = description.trim()
    if (!actionDate || !trimmedDescription) {
      toast.error('Action date and description are required.')
      return
    }

    const parsedBudget = budgetAmount.trim()
      ? Number.parseFloat(budgetAmount.replace(',', '.'))
      : null
    if (parsedBudget != null && (!Number.isFinite(parsedBudget) || parsedBudget < 0)) {
      toast.error('Please enter a valid budget amount.')
      return
    }

    setIsSaving(true)

    try {
      if (editingId) {
        // Update existing entry
        await updatePromoLogEntry(supabase, editingId, {
          action_date: actionDate,
          description: trimmedDescription,
          budget_amount: parsedBudget,
          budget_currency: budgetCurrency,
          proof_url: proofUrl,
          proof_r2_key: proofR2Key,
        })
        setEditingId(null)
        toast.success('Promo log entry updated.')
      } else {
        // Create new entry
        const { data, error } = await supabase.auth.getUser()
        if (error) throw error
        if (!data.user) throw new Error('You must be signed in to create promo log entries.')

        const payload: PromoLogInsert = {
          artist_id: activeArtistId,
          action_date: actionDate,
          description: trimmedDescription,
          budget_currency: budgetCurrency,
          proof_url: proofUrl,
          proof_r2_key: proofR2Key,
          created_by: data.user.id,
        }
        if (parsedBudget != null) payload.budget_amount = parsedBudget

        await createPromoLogEntry(supabase, payload)
        toast.success('Promo log entry created.')
      }

      setActionDate(getDefaultActionDate())
      setDescription('')
      setBudgetAmount('')
      setBudgetCurrency('EUR')
      setProofUrl(null)
      setProofR2Key(null)
      setProofPreview(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save promo log entry.')
    } finally {
      setIsSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
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

      {/* Artist selector */}
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

      {/* Entry form (create or edit) */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>
            {editingId ? `Edit Entry${activeArtist ? ` — ${activeArtist.name}` : ''}` : `New Entry${activeArtist ? ` — ${activeArtist.name}` : ''}`}
          </CardTitle>
          <CardDescription>
            {editingId
              ? 'Update this marketing activity. You can paste a new screenshot with Ctrl+V anywhere in this form.'
              : 'Create a new marketing activity. You can paste a screenshot with Ctrl+V anywhere in this form.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Paste zone — listens for clipboard paste anywhere inside */}
          <div ref={formRef}>
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

              {/* Proof image — paste or file select */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Camera size={14} aria-hidden="true" />
                  Proof / Screenshot (optional)
                </Label>
                {proofPreview ? (
                  <div className="relative inline-block overflow-hidden rounded-md border border-border">
                    <Image
                      src={proofPreview}
                      alt="Proof screenshot preview"
                      width={320}
                      height={180}
                      className="object-cover"
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={removeProof}
                      aria-label="Remove proof image"
                      className="absolute right-1 top-1 flex min-h-[28px] min-w-[28px] items-center justify-center rounded-full bg-black/70 p-0.5 text-white transition-colors hover:bg-black/90"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                    {uploadingProof && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Spinner size={24} className="animate-spin text-white" aria-label="Uploading" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ImageIcon size={13} aria-hidden="true" />
                      Paste a screenshot with{' '}
                      <kbd className="rounded bg-muted px-1 font-mono text-[11px]">Ctrl+V</kbd>
                      {' '}anywhere in this form, or click to browse.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingProof || !activeArtistId}
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      {uploadingProof ? (
                        <Spinner size={14} className="mr-1 animate-spin" aria-hidden="true" />
                      ) : (
                        <Camera size={14} className="mr-1" aria-hidden="true" />
                      )}
                      Choose image
                    </Button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  aria-label="Choose proof image file"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadProofFile(file)
                    e.target.value = ''
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  disabled={isSaving || uploadingProof}
                  className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {isSaving ? (
                    <>
                      <Spinner size={16} className="mr-2 animate-spin" aria-hidden="true" />
                      Saving…
                    </>
                  ) : editingId ? (
                    'Update entry'
                  ) : (
                    'Create entry'
                  )}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                    className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Existing entries */}
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
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
