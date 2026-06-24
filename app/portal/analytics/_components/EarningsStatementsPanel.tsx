'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { DownloadSimple, FileText, Spinner } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SalesStatement } from '@/lib/api/salesStatements'
import type { Dictionary } from '@/i18n/types'
import { getStatementPresignedUrl } from '../../statements/_actions/presignedUrl'
import { QuickInvoiceButton } from './QuickInvoiceButton'
import { matchesQuickSearch } from '@/lib/analytics/insights'

interface EarningsStatementsPanelProps {
  artistId: string
  billingProfileComplete: boolean
  dict: Dictionary['portal']
  invoicedStatementIds: string[]
  searchQuery: string
  statements: SalesStatement[]
}

function formatAmountEur(amount: number | undefined): string {
  if (amount === undefined) return '—'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function EarningsStatementsPanel({
  artistId,
  billingProfileComplete,
  dict,
  invoicedStatementIds,
  searchQuery,
  statements,
}: EarningsStatementsPanelProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const linkedIds = new Set(invoicedStatementIds)

  const filtered = statements.filter((s) =>
    matchesQuickSearch(searchQuery, s.period, s.filename, s.status, s.amountEur),
  )

  const handleDownload = async (statementId: string) => {
    setLoadingId(statementId)
    toast.info(dict.statements_downloading)
    try {
      const result = await getStatementPresignedUrl(statementId)
      if (result.error || !result.url) {
        toast.error(dict.statements_downloadError)
        return
      }
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error(dict.statements_downloadError)
    } finally {
      setLoadingId(null)
    }
  }

  if (statements.length === 0) return null

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText size={18} aria-hidden="true" />
          {dict.analytics_statements_heading}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dict.analytics_search_no_results}</p>
        ) : (
          filtered.map((statement) => {
            const hasInvoice = linkedIds.has(statement.id)
            const canInvoice = statement.status === 'label_approved' && !hasInvoice

            return (
              <div
                key={statement.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-medium">{statement.period}</p>
                  <p className="text-xs text-muted-foreground truncate">{statement.filename}</p>
                  <p className="text-sm tabular-nums mt-1">{formatAmountEur(statement.amountEur)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {hasInvoice && (
                    <Badge variant="secondary">{dict.analytics_invoice_exists}</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loadingId === statement.id}
                    onClick={() => handleDownload(statement.id)}
                  >
                    {loadingId === statement.id ? (
                      <Spinner size={14} className="mr-1 animate-spin" aria-hidden="true" />
                    ) : (
                      <DownloadSimple size={14} className="mr-1" aria-hidden="true" />
                    )}
                    {dict.statements_download}
                  </Button>
                  {canInvoice && (
                    <QuickInvoiceButton
                      artistId={artistId}
                      billingProfileComplete={billingProfileComplete}
                      dict={dict}
                      statement={statement}
                    />
                  )}
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}