'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { PaperPlaneTilt, Spinner } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import {
  DEFAULT_INVOICE_DUE_DAYS,
  DEFAULT_TAX_RATE_PCT,
} from '@/lib/analytics/constants'
import {
  LABEL_CLIENT_ADDRESS,
  LABEL_CLIENT_EMAIL,
  LABEL_CLIENT_NAME,
} from '@/lib/portal/labelBilling'
import type { SalesStatement } from '@/lib/api/salesStatements'

interface QuickInvoiceButtonProps {
  artistId: string
  statement: SalesStatement
}

function dueDateFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function defaultArtistInvoiceNumber(period: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `SOS-${period}-${stamp}`
}

export function QuickInvoiceButton({
  artistId,
  statement,
}: QuickInvoiceButtonProps) {
  const t = useTranslations('portal')

  const [submitting, setSubmitting] = useState(false)

  const handleQuickInvoice = async () => {
    setSubmitting(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error(t('profile_error'))

      const amountCents = Math.round((statement.amountEur ?? 0) * 100)
      const response = await fetch('/api/portal/invoices', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artist_id: artistId,
          artist_invoice_number: defaultArtistInvoiceNumber(statement.period),
          client_name: LABEL_CLIENT_NAME,
          client_email: LABEL_CLIENT_EMAIL,
          client_address: LABEL_CLIENT_ADDRESS,
          statement_id: statement.id,
          line_items: [{
            description: `Musikalische Dienstleistungen gemäß Statement of Sales ${statement.period}`,
            qty: 1,
            unit_price_cents: amountCents,
          }],
          currency: 'EUR',
          tax_rate_pct: DEFAULT_TAX_RATE_PCT,
          due_date: dueDateFromNow(DEFAULT_INVOICE_DUE_DAYS),
          send_email: true,
          send_to_label: true,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { message?: string }
        throw new Error(payload.message ?? t('invoice_error'))
      }

      toast.success(t('analytics_invoice_sent'))
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('invoice_error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Button
      size="sm"
      disabled={submitting}
      onClick={handleQuickInvoice}
      className="gap-1"
    >
      {submitting ? (
        <Spinner size={14} className="animate-spin" aria-hidden="true" />
      ) : (
        <PaperPlaneTilt size={14} aria-hidden="true" />
      )}
      {t('analytics_invoice_one_click')}
    </Button>
  )
}