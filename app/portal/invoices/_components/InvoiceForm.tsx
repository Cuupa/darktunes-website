'use client'

/**
 * app/portal/invoices/_components/InvoiceForm.tsx
 *
 * Multi-line-item invoice creation form.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash } from '@phosphor-icons/react'
import type { ArtistInvoice } from '@/lib/api/artistInvoices'
import type { Dictionary } from '@/i18n/types'

interface LineItem {
  description: string
  qty: number
  unit_price_cents: number
}

interface InvoiceFormProps {
  dict: Dictionary['portal']
  artistId: string
  onSuccess: (invoice: ArtistInvoice) => void
  onCancel: () => void
}

export function InvoiceForm({ dict, artistId, onSuccess, onCancel }: InvoiceFormProps) {
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [taxRatePct, setTaxRatePct] = useState(19)
  const [sendEmail, setSendEmail] = useState(true)
  const [sendToLabel, setSendToLabel] = useState(true)
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', qty: 1, unit_price_cents: 0 },
  ])
  const [submitting, setSubmitting] = useState(false)

  const addLineItem = () =>
    setLineItems((prev) => [...prev, { description: '', qty: 1, unit_price_cents: 0 }])

  const removeLineItem = (idx: number) =>
    setLineItems((prev) => prev.filter((_, i) => i !== idx))

  const updateLineItem = (idx: number, field: keyof LineItem, value: string | number) =>
    setLineItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item,
      ),
    )

  const subtotal = lineItems.reduce((s, li) => s + li.qty * li.unit_price_cents, 0)
  const tax = Math.round(subtotal * (taxRatePct / 100))
  const total = subtotal + tax

  const formatCents = (cents: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(cents / 100)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientName || !clientEmail || !dueDate) {
      toast.error(dict.invoice_client + ' is required')
      return
    }
    setSubmitting(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error(dict.profile_error); return }

      const res = await fetch('/api/portal/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ['Bearer', session.access_token].join(' '),
        },
        body: JSON.stringify({
          artist_id: artistId,
          client_name: clientName,
          client_email: clientEmail,
          client_address: clientAddress || undefined,
          line_items: lineItems,
          currency,
          tax_rate_pct: taxRatePct,
          due_date: dueDate,
          send_email: sendEmail,
          send_to_label: sendToLabel,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error((err as { error?: string }).error ?? 'Failed to create invoice')
      }
      const json = await res.json() as { invoice: ArtistInvoice }
      onSuccess(json.invoice)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.profile_error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{dict.invoice_new}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client details */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="inv-client-name">{dict.invoice_client}</Label>
              <Input
                id="inv-client-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                placeholder="Booker GmbH"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-client-email">E-Mail</Label>
              <Input
                id="inv-client-email"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                required
                placeholder="booker@example.com"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="inv-client-address">Address</Label>
              <Input
                id="inv-client-address"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="Street, City, Country"
              />
            </div>
          </div>

          {/* Dates + currency */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="inv-due-date">Due Date</Label>
              <Input
                id="inv-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-currency">Currency</Label>
              <select
                id="inv-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-tax">Tax %</Label>
              <Input
                id="inv-tax"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={taxRatePct}
                onChange={(e) => setTaxRatePct(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{dict.invoice_line_items}</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLineItem} className="gap-1">
                <Plus size={14} aria-hidden="true" />
                Add
              </Button>
            </div>
            {lineItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_100px_36px] gap-2 items-center">
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                  required
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={item.qty}
                  onChange={(e) => updateLineItem(idx, 'qty', parseInt(e.target.value, 10) || 1)}
                />
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Price (cents)"
                  value={item.unit_price_cents}
                  onChange={(e) => updateLineItem(idx, 'unit_price_cents', parseInt(e.target.value, 10) || 0)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={lineItems.length === 1}
                  onClick={() => removeLineItem(idx)}
                  aria-label="Remove line item"
                >
                  <Trash size={14} aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>

          {/* Totals preview */}
          <div className="text-sm text-muted-foreground space-y-1 border-t pt-3">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCents(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax ({taxRatePct}%)</span>
              <span>{formatCents(tax)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground">
              <span>{dict.invoice_total}</span>
              <span>{formatCents(total)}</span>
            </div>
          </div>

          {/* Send email toggle */}
          <div className="flex items-center gap-2">
            <input
              id="inv-send-email"
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="inv-send-email">{dict.invoice_send}</Label>
          </div>

          {/* Send copy to label */}
          <div className="flex items-center gap-2">
            <input
              id="inv-send-to-label"
              type="checkbox"
              checked={sendToLabel}
              onChange={(e) => setSendToLabel(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="inv-send-to-label">{dict.invoice_send_to_label}</Label>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : dict.invoice_send}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
