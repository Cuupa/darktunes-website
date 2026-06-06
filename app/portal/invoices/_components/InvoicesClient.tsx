'use client'

/**
 * app/portal/invoices/_components/InvoicesClient.tsx
 *
 * Main invoices page client component — renders the invoice list and
 * the new-invoice form.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, DownloadSimple, FileText, Spinner } from '@phosphor-icons/react'
import { PortalEmptyState } from '@/components/portal/PortalEmptyState'
import { InvoiceForm } from './InvoiceForm'
import type { ArtistInvoice } from '@/lib/api/artistInvoices'
import type { Dictionary } from '@/i18n/types'

interface InvoicesClientProps {
  dict: Dictionary['portal']
  invoices: ArtistInvoice[]
  artistId: string
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'paid': return 'default'
    case 'sent': return 'secondary'
    case 'cancelled': return 'destructive'
    default: return 'outline'
  }
}

function statusLabel(status: string, dict: Dictionary['portal']): string {
  switch (status) {
    case 'draft': return dict.invoice_status_draft
    case 'sent': return dict.invoice_status_sent
    case 'paid': return dict.invoice_status_paid
    case 'cancelled': return dict.invoice_status_cancelled
    default: return status
  }
}

export function InvoicesClient({ dict, invoices: initialInvoices, artistId }: InvoicesClientProps) {
  const [invoices, setInvoices] = useState<ArtistInvoice[]>(initialInvoices)
  const [showForm, setShowForm] = useState(false)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)

  const handleNewInvoice = (invoice: ArtistInvoice) => {
    setInvoices((prev) => [invoice, ...prev])
    setShowForm(false)
    toast.success(dict.invoice_sent_success)
  }

  const handleMarkPaid = async (invoiceId: string) => {
    setMarkingPaid(invoiceId)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error(dict.profile_error); return }

      const res = await fetch(`/api/portal/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ['Bearer', session.access_token].join(' '),
        },
        body: JSON.stringify({ artist_id: artistId, status: 'paid' }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const json = await res.json() as { invoice: ArtistInvoice }
      setInvoices((prev) => prev.map((inv) => inv.id === invoiceId ? json.invoice : inv))
      toast.success(dict.invoice_status_paid)
    } catch {
      toast.error(dict.profile_error)
    } finally {
      setMarkingPaid(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{dict.invoices_heading}</h1>
        <Button onClick={() => setShowForm((v) => !v)} size="sm" className="gap-2">
          <Plus size={16} aria-hidden="true" />
          {dict.invoice_new}
        </Button>
      </div>

      {showForm && (
        <InvoiceForm
          dict={dict}
          artistId={artistId}
          onSuccess={handleNewInvoice}
          onCancel={() => setShowForm(false)}
        />
      )}

      {invoices.length === 0 ? (
        <PortalEmptyState
          icon={FileText}
          heading={dict.invoices_heading}
          description={dict.invoice_new}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{dict.invoices_heading}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.invoice_number ?? '#'}</TableHead>
                  <TableHead>{dict.invoice_client}</TableHead>
                  <TableHead>{dict.invoice_total}</TableHead>
                  <TableHead>{dict.invoice_status_draft}</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const subtotal = inv.lineItems.reduce((s, li) => s + li.qty * li.unit_price_cents, 0)
                  const tax = Math.round(subtotal * (inv.taxRatePct / 100))
                  const total = (subtotal + tax) / 100
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                      <TableCell>{inv.clientName}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat('de-DE', { style: 'currency', currency: inv.currency }).format(total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(inv.status)}>
                          {statusLabel(inv.status, dict)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {inv.pdfUrl && (
                            <Button asChild variant="ghost" size="sm">
                              <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="gap-1">
                                <DownloadSimple size={14} aria-hidden="true" />
                                PDF
                              </a>
                            </Button>
                          )}
                          {inv.status === 'sent' && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={markingPaid === inv.id}
                              onClick={() => handleMarkPaid(inv.id)}
                            >
                              {markingPaid === inv.id
                                ? <Spinner size={14} className="animate-spin" aria-hidden="true" />
                                : dict.invoice_status_paid}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
