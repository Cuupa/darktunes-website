'use client'

/**
 * src/components/admin/PromoLogManager.tsx
 *
 * Admin UI for documenting marketing activities (Promo-Logbuch).
 * Key feature: paste-from-clipboard support for proof screenshots —
 * the admin can copy a screenshot and paste it directly into the form
 * without saving to disk first.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { format, parseISO } from 'date-fns'
import {
  CalendarBlank,
  Camera,
  CurrencyEur,
  Image as ImageIcon,
  PencilSimple,
  PlusCircle,
  Spinner,
  Trash,
  X,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { PromoLogEntry } from '@/types'

interface PromoLogManagerProps {
  artistId: string
  artistName?: string
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBudget(amount: number | null, currency: string): string {
  if (amount == null) return ''
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd.MM.yyyy')
  } catch {
    return dateStr
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PromoLogManager({ artistId, artistName }: PromoLogManagerProps) {
  const [entries, setEntries] = useState<PromoLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [actionDate, setActionDate] = useState(() => new Date().toISOString().split('T')[0] ?? '')
  const [description, setDescription] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetCurrency, setBudgetCurrency] = useState<(typeof CURRENCIES)[number]>('EUR')
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [proofR2Key, setProofR2Key] = useState<string | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)

  const formRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---------------------------------------------------------------------------
  // Load entries
  // ---------------------------------------------------------------------------
  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/admin/promo-log?artistId=${artistId}`, {
        headers: { Authorization: 'Bearer ' + session.access_token },
      })
      if (!res.ok) throw new Error('Failed to load entries')
      const json = (await res.json()) as { entries: PromoLogEntry[] }
      setEntries(json.entries)
    } catch {
      toast.error('Failed to load promo log entries')
    } finally {
      setLoading(false)
    }
  }, [artistId])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  // ---------------------------------------------------------------------------
  // Upload proof image
  // ---------------------------------------------------------------------------
  const uploadProofFile = useCallback(async (file: File) => {
    setUploadingProof(true)
    // Show immediate local preview so the admin sees feedback right away
    const localPreview = URL.createObjectURL(file)
    setProofPreview(localPreview)

    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const body = new FormData()
      body.append('file', file)
      body.append('artistId', artistId)

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
  }, [artistId])

  // ---------------------------------------------------------------------------
  // Clipboard paste — extract image and upload to R2
  // ---------------------------------------------------------------------------
  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageItem = items.find((item) => item.type.startsWith('image/'))
      if (!imageItem) return

      e.preventDefault()

      const file = imageItem.getAsFile()
      if (!file) return

      await uploadProofFile(file)
    },
    [uploadProofFile],
  )

  useEffect(() => {
    const el = formRef.current
    if (!el) return
    const listener = (e: Event) => void handlePaste(e as ClipboardEvent)
    el.addEventListener('paste', listener)
    return () => el.removeEventListener('paste', listener)
  }, [handlePaste])

  function removeProof() {
    setProofUrl(null)
    setProofR2Key(null)
    setProofPreview(null)
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
    setActionDate(() => new Date().toISOString().split('T')[0] ?? '')
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
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim() || !actionDate) {
      toast.error('Date and description are required.')
      return
    }

    setSaving(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const parsedBudget = budgetAmount ? parseFloat(budgetAmount.replace(',', '.')) : null
      if (budgetAmount && (isNaN(parsedBudget!) || parsedBudget! < 0)) {
        throw new Error('Invalid budget amount')
      }

      if (editingId) {
        // Update existing entry via PATCH
        const res = await fetch('/api/admin/promo-log', {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer ' + session.access_token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: editingId,
            actionDate,
            description: description.trim(),
            budgetAmount: parsedBudget,
            budgetCurrency,
            proofUrl,
            proofR2Key,
          }),
        })

        if (!res.ok) {
          const err = (await res.json()) as { error?: string }
          throw new Error(err.error ?? 'Failed to update entry')
        }

        const { entry } = (await res.json()) as { entry: PromoLogEntry }
        setEntries((prev) => prev.map((e) => (e.id === editingId ? entry : e)))
        setEditingId(null)
        toast.success('Marketing activity updated.')
      } else {
        // Create new entry via POST
        const res = await fetch('/api/admin/promo-log', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + session.access_token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            artistId,
            actionDate,
            description: description.trim(),
            budgetAmount: parsedBudget,
            budgetCurrency,
            proofUrl,
            proofR2Key,
          }),
        })

        if (!res.ok) {
          const err = (await res.json()) as { error?: string }
          throw new Error(err.error ?? 'Failed to save entry')
        }

        const { entry } = (await res.json()) as { entry: PromoLogEntry }
        setEntries((prev) => [entry, ...prev])
        toast.success('Marketing activity logged.')
      }

      // Reset form
      setDescription('')
      setBudgetAmount('')
      setProofUrl(null)
      setProofR2Key(null)
      setProofPreview(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Delete entry
  // ---------------------------------------------------------------------------
  async function handleDelete(id: string) {
    if (!window.confirm('Delete this marketing activity?')) return
    setDeletingId(id)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/promo-log', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? 'Delete failed')
      }

      setEntries((prev) => prev.filter((e) => e.id !== id))
      toast.success('Entry deleted.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Input form                                                           */}
      {/* ------------------------------------------------------------------ */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlusCircle size={18} aria-hidden="true" />
            {editingId
              ? `Edit Activity${artistName ? ` — ${artistName}` : ''}`
              : `Log Marketing Activity${artistName ? ` — ${artistName}` : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Paste zone — listens for clipboard paste anywhere inside */}
          <div ref={formRef}>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {/* Date + Description */}
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4">
                <div className="space-y-1">
                  <Label htmlFor="promo-date" className="flex items-center gap-1">
                    <CalendarBlank size={14} aria-hidden="true" />
                    Date <span aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id="promo-date"
                    type="date"
                    required
                    value={actionDate}
                    onChange={(e) => setActionDate(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="promo-description">
                    Activity description <span aria-hidden="true">*</span>
                  </Label>
                  <Textarea
                    id="promo-description"
                    required
                    maxLength={1000}
                    placeholder="e.g. Newsletter sent to 10k contacts, Spotify playlist pitch for…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* Budget */}
              <div className="grid grid-cols-2 sm:grid-cols-[1fr_120px] gap-4">
                <div className="space-y-1">
                  <Label htmlFor="promo-budget" className="flex items-center gap-1">
                    <CurrencyEur size={14} aria-hidden="true" />
                    Budget (optional)
                  </Label>
                  <Input
                    id="promo-budget"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="promo-currency">Currency</Label>
                  <Select
                    value={budgetCurrency}
                    onValueChange={(v) => setBudgetCurrency(v as (typeof CURRENCIES)[number])}
                  >
                    <SelectTrigger id="promo-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
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
                  <div className="relative inline-block rounded-md overflow-hidden border border-border">
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
                      className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 text-white hover:bg-black/90 transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                    {uploadingProof && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Spinner size={24} className="animate-spin text-white" aria-label="Uploading" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <ImageIcon size={13} aria-hidden="true" />
                      Paste a screenshot with{' '}
                      <kbd className="rounded bg-muted px-1 font-mono text-[11px]">Ctrl+V</kbd>
                      {' '}anywhere in this form, or click to browse.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingProof}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingProof ? (
                        <Spinner size={14} className="mr-1 animate-spin" aria-label="Uploading" />
                      ) : (
                        <Camera size={14} className="mr-1" aria-hidden="true" />
                      )}
                      Choose image
                    </Button>
                  </div>
                )}
                {/* Hidden file input for browse-and-select */}
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
                <Button type="submit" disabled={saving || uploadingProof} className="w-full sm:w-auto">
                  {saving ? (
                    <Spinner size={16} className="mr-2 animate-spin" aria-label="Saving" />
                  ) : (
                    <PlusCircle size={16} className="mr-2" aria-hidden="true" />
                  )}
                  {saving ? 'Saving…' : editingId ? 'Update Activity' : 'Save'}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Existing entries                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Activity Log ({entries.length})
        </h3>

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activities logged yet. Use the form above to document the first one.
          </p>
        ) : (
          entries.map((entry) => (
            <Card key={entry.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Proof thumbnail */}
                  {entry.proofUrl && (
                    <a
                      href={entry.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 overflow-hidden rounded border border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      aria-label="View proof screenshot"
                    >
                      <Image
                        src={getOptimizedImageUrl(entry.proofUrl, 160)}
                        alt="Proof screenshot"
                        width={80}
                        height={60}
                        className="object-cover"
                        unoptimized
                      />
                    </a>
                  )}

                  {/* Content */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <time
                        dateTime={entry.actionDate}
                        className="text-xs font-mono text-muted-foreground"
                      >
                        {formatDate(entry.actionDate)}
                      </time>
                      {entry.budgetAmount != null && (
                        <span className="text-xs font-semibold text-primary">
                          {formatBudget(entry.budgetAmount, entry.budgetCurrency)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{entry.description}</p>
                  </div>

                  {/* Edit + Delete */}
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(entry)}
                      aria-label="Edit marketing activity"
                      className="min-h-[36px] min-w-[36px] text-muted-foreground hover:text-foreground"
                    >
                      <PencilSimple size={14} aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={deletingId === entry.id}
                      onClick={() => void handleDelete(entry.id)}
                      aria-label="Delete marketing activity"
                      className="min-h-[36px] min-w-[36px] text-muted-foreground hover:text-destructive"
                    >
                      {deletingId === entry.id ? (
                        <Spinner size={14} className="animate-spin" aria-label="Deleting" />
                      ) : (
                        <Trash size={16} aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
