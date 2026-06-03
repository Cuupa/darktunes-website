'use client'

/**
 * src/components/admin/StatementsManager.tsx
 *
 * Read-only admin overview of all uploaded Statement-of-Sales PDFs.
 * Displays artist name, period, amount, filename, and upload timestamp
 * sorted by newest first.
 */

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

type StatementRow = {
  id: string
  artist_id: string
  filename: string
  period: string
  amount_eur: number | null
  created_at: string
  artists: { name: string }
}

export function StatementsManager() {
  const [statements, setStatements] = useState<StatementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchStatements() {
      setLoading(true)
      setError(null)

      const supabase = createBrowserSupabaseClient()
      const { data, error: fetchError } = await supabase
        .from('sales_statements')
        .select(`
          id,
          artist_id,
          filename,
          period,
          amount_eur,
          created_at,
          artists!inner(name)
        `)
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      setStatements((data ?? []) as StatementRow[])
      setLoading(false)
    }

    void fetchStatements()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading statements">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load statements: {error}
      </p>
    )
  }

  if (statements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No statements uploaded yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Artist Name</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Amount (EUR)</TableHead>
            <TableHead>Filename</TableHead>
            <TableHead>Created At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statements.map((stmt) => (
            <TableRow key={stmt.id}>
              <TableCell>{stmt.artists.name}</TableCell>
              <TableCell>{stmt.period}</TableCell>
              <TableCell>
                {stmt.amount_eur !== null
                  ? `€${stmt.amount_eur.toFixed(2)}`
                  : '—'}
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs">{stmt.filename}</span>
              </TableCell>
              <TableCell>
                {new Date(stmt.created_at).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
