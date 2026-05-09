'use client'

/**
 * app/portal/statements/_components/StatementsTable.tsx — Client Component (leaf)
 *
 * Renders the list of royalty statements with secure download buttons.
 * Each download triggers the getStatementPresignedUrl Server Action, which
 * returns a short-lived (5 min) presigned URL without exposing R2 credentials.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DownloadSimple, Spinner } from '@phosphor-icons/react'
import { getStatementPresignedUrl } from '../_actions/presignedUrl'
import type { SalesStatement } from '@/lib/api/salesStatements'
import type { Dictionary } from '@/i18n/types'

interface StatementsTableProps {
  dict: Dictionary['portal']
  statements: SalesStatement[]
}

function formatAmountEur(amount: number | undefined): string {
  if (amount === undefined) return '—'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function StatementsTable({ dict, statements }: StatementsTableProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleDownload = async (statementId: string, filename: string) => {
    setLoadingId(statementId)
    toast.info(dict.statements_downloading)

    try {
      const result = await getStatementPresignedUrl(statementId)

      if (result.error || !result.url) {
        toast.error(dict.statements_downloadError)
        return
      }

      // Open the presigned URL in a new tab to trigger the browser download
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
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{dict.statements_noData}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">{dict.statements_heading}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>{dict.statements_period}</TableHead>
                  <TableHead>{dict.statements_filename}</TableHead>
                  <TableHead className="text-right">{dict.statements_amount}</TableHead>
                  <TableHead className="text-right">{dict.statements_download}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((stmt) => (
                  <TableRow key={stmt.id} className="border-border hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">{stmt.period}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{stmt.filename}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatAmountEur(stmt.amountEur)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border hover:bg-primary/10 hover:text-primary"
                        disabled={loadingId === stmt.id}
                        onClick={() => handleDownload(stmt.id, stmt.filename)}
                      >
                        {loadingId === stmt.id ? (
                          <Spinner size={14} className="animate-spin mr-1" />
                        ) : (
                          <DownloadSimple size={14} className="mr-1" />
                        )}
                        {dict.statements_download}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
