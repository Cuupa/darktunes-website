'use client'

import Link from 'next/link'
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
import type { SalesStatement } from '@/lib/api/salesStatements'
import type { Dictionary } from '@/i18n/types'
import { getStatementPresignedUrl } from '../_actions/presignedUrl'

interface StatementsTableProps {
  artistId?: string
  dict: Dictionary['portal']
  invoicedStatementIds: string[]
  statements: SalesStatement[]
}

function formatAmountEur(amount: number | undefined): string {
  if (amount === undefined) return '—'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

function statusLabel(status: SalesStatement['status'], dict: Dictionary['portal']): string {
  switch (status) {
    case 'draft':
      return dict.statements_status_draft
    case 'label_approved':
      return dict.statements_status_approved
    case 'artist_notified':
      return dict.statements_status_notified
    case 'acknowledged':
      return dict.statements_status_acknowledged
    default:
      return status
  }
}

function statusVariant(status: SalesStatement['status']): 'outline' | 'secondary' | 'default' {
  switch (status) {
    case 'label_approved':
      return 'secondary'
    case 'acknowledged':
      return 'default'
    default:
      return 'outline'
  }
}

export function StatementsTable({ artistId, dict, invoicedStatementIds, statements }: StatementsTableProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const linkedStatementIds = new Set(invoicedStatementIds)

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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{dict.statements_heading}</h1>

      {statements.length === 0 ? (
        <PortalEmptyState icon={FileText} heading={dict.statements_noData} description={dict.statements_heading} />
      ) : (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">{dict.statements_heading}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="whitespace-nowrap">{dict.statements_period}</TableHead>
                  <TableHead>{dict.statements_filename}</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap text-right">{dict.statements_amount}</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((statement) => {
                  const hasInvoice = linkedStatementIds.has(statement.id)
                  const createInvoiceHref = artistId
                    ? `/portal/invoices?artistId=${artistId}&statement=${statement.id}`
                    : `/portal/invoices?statement=${statement.id}`

                  return (
                    <TableRow key={statement.id} className="border-border hover:bg-muted/50">
                      <TableCell className="whitespace-nowrap font-mono text-sm">{statement.period}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{statement.filename}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(statement.status)}>{statusLabel(statement.status, dict)}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono text-sm">
                        {formatAmountEur(statement.amountEur)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border hover:bg-primary/10 hover:text-primary"
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
                          {statement.status === 'label_approved' && !hasInvoice && (
                            <Button asChild size="sm">
                              <Link href={createInvoiceHref}>{dict.statements_create_invoice}</Link>
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
