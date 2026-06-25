'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PortalEmptyState } from '@/components/portal/PortalEmptyState'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DownloadSimple, FileText, Spinner } from '@phosphor-icons/react'
import type { ArtistBillingProfile } from '@/lib/api/artistBillingProfiles'
import type { SalesStatement } from '@/lib/api/salesStatements'
import { getStatementPresignedUrl } from '../_actions/presignedUrl'
import { InlineBillingProfileStep } from '../../invoices/_components/InlineBillingProfileStep'
import { QuickInvoiceButton } from '../../analytics/_components/QuickInvoiceButton'

interface StatementsTableProps {
  artistId?: string
  billingProfile: ArtistBillingProfile | null
  billingProfileComplete: boolean
  invoicedStatementIds: string[]
  statements: SalesStatement[]
}

function formatAmountEur(amount: number | undefined): string {
  if (amount === undefined) return '—'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

function statusLabel(status: SalesStatement['status'], t: ReturnType<typeof useTranslations<'portal'>>): string {
  switch (status) {
    case 'draft':
      return t('statements_status_draft')
    case 'label_approved':
      return t('statements_status_approved')
    case 'artist_notified':
      return t('statements_status_notified')
    case 'viewed':
      return t('statements_status_viewed')
    case 'invoiced':
      return t('statements_status_invoiced')
    case 'acknowledged':
      return t('statements_status_acknowledged')
    case 'paid':
      return t('statements_status_paid')
    case 'superseded':
      return t('statements_status_superseded')
    case 'cancelled':
      return t('statements_status_cancelled')
    default:
      return status
  }
}

function statusVariant(status: SalesStatement['status']): 'outline' | 'secondary' | 'default' {
  switch (status) {
    case 'label_approved':
    case 'artist_notified':
    case 'viewed':
      return 'secondary'
    case 'invoiced':
    case 'acknowledged':
    case 'paid':
      return 'default'
    case 'superseded':
    case 'cancelled':
      return 'outline'
    default:
      return 'outline'
  }
}

function StatementActions({
  artistId,
  billingProfileComplete,
  hasInvoice,
  loadingId,
  onDownload,
  statement,
}: {
  artistId?: string
  billingProfileComplete: boolean
  hasInvoice: boolean
  loadingId: string | null
  onDownload: (id: string) => void
  statement: SalesStatement
}) {
  const t = useTranslations('portal')
  const canInvoice = ['label_approved', 'artist_notified', 'viewed'].includes(statement.status) && !hasInvoice

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        className="border-border hover:bg-primary/10 hover:text-primary"
        disabled={loadingId === statement.id}
        onClick={() => onDownload(statement.id)}
      >
        {loadingId === statement.id ? (
          <Spinner size={14} className="mr-1 animate-spin" aria-hidden="true" />
        ) : (
          <DownloadSimple size={14} className="mr-1" aria-hidden="true" />
        )}
        {t('statements_download')}
      </Button>
      {canInvoice && artistId && billingProfileComplete && (
        <QuickInvoiceButton
          artistId={artistId}
          statement={statement}
        />
      )}
    </div>
  )
}

export function StatementsTable({
  artistId,
  billingProfile: initialBillingProfile,
  billingProfileComplete: initialBillingProfileComplete,
  invoicedStatementIds,
  statements,
}: StatementsTableProps) {
  const t = useTranslations('portal')

  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [billingProfile, setBillingProfile] = useState(initialBillingProfile)
  const [billingProfileComplete, setBillingProfileComplete] = useState(initialBillingProfileComplete)
  const linkedStatementIds = new Set(invoicedStatementIds)

  const hasInvoiceableStatement = statements.some(
    (statement) =>
      ['label_approved', 'artist_notified', 'viewed'].includes(statement.status) &&
      !linkedStatementIds.has(statement.id),
  )

  const handleDownload = async (statementId: string) => {
    setLoadingId(statementId)
    toast.info(t('statements_downloading'))

    try {
      const result = await getStatementPresignedUrl(statementId)

      if (result.error || !result.url) {
        toast.error(t('statements_downloadError'))
        return
      }

      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error(t('statements_downloadError'))
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('statements_heading')}</h1>

      {statements.length === 0 ? (
        <PortalEmptyState icon={FileText} heading={t('statements_noData')} description={t('statements_heading')} />
      ) : (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t('statements_heading')}</CardTitle>
          </CardHeader>
          {!billingProfileComplete && hasInvoiceableStatement && artistId && (
            <CardContent className="p-4 pt-0 pb-0">
              <InlineBillingProfileStep
                artistId={artistId}
                billingProfile={billingProfile}
                onComplete={(profile) => {
                  setBillingProfile(profile)
                  setBillingProfileComplete(true)
                }}
              />
            </CardContent>
          )}
          <CardContent className="p-4 pt-0 space-y-3 md:hidden">
            {statements.map((statement) => {
              const hasInvoice = linkedStatementIds.has(statement.id)
              return (
                <div
                  key={statement.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="font-mono text-sm font-medium">{statement.period}</p>
                    <p className="text-xs text-muted-foreground truncate">{statement.filename}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={statusVariant(statement.status)}>
                        {statusLabel(statement.status, t)}
                      </Badge>
                      <span className="text-sm tabular-nums">{formatAmountEur(statement.amountEur)}</span>
                    </div>
                    {hasInvoice && (
                      <Badge variant="secondary" className="mt-2">{t('analytics_invoice_exists')}</Badge>
                    )}
                  </div>
                  <StatementActions
                    artistId={artistId}
                    billingProfileComplete={billingProfileComplete}
                    hasInvoice={hasInvoice}
                    loadingId={loadingId}
                    onDownload={handleDownload}
                    statement={statement}
                  />
                </div>
              )
            })}
          </CardContent>
          <CardContent className="hidden md:block overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="whitespace-nowrap">{t('statements_period')}</TableHead>
                  <TableHead>{t('statements_filename')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('statements_status')}</TableHead>
                  <TableHead className="whitespace-nowrap text-right">{t('statements_amount')}</TableHead>
                  <TableHead className="whitespace-nowrap text-right">{t('statements_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((statement) => {
                  const hasInvoice = linkedStatementIds.has(statement.id)
                  return (
                    <TableRow key={statement.id} className="border-border hover:bg-muted/50">
                      <TableCell className="whitespace-nowrap font-mono text-sm">{statement.period}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{statement.filename}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(statement.status)}>
                          {statusLabel(statement.status, t)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono text-sm">
                        {formatAmountEur(statement.amountEur)}
                      </TableCell>
                      <TableCell className="text-right">
                        <StatementActions
                          artistId={artistId}
                          billingProfileComplete={billingProfileComplete}
                          hasInvoice={hasInvoice}
                          loadingId={loadingId}
                          onDownload={handleDownload}
                          statement={statement}
                        />
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