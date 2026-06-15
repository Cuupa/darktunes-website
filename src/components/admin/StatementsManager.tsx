'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

type StatementStatus = 'draft' | 'label_approved' | 'artist_notified' | 'acknowledged'

type StatementRow = {
  id: string
  artist_id: string
  filename: string
  period: string
  amount_eur: number | null
  status: StatementStatus
  label_notes: string | null
  created_at: string
  artists: { name: string }
}

function badgeVariant(status: StatementStatus): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'acknowledged':
      return 'default'
    case 'label_approved':
      return 'secondary'
    default:
      return 'outline'
  }
}

export function StatementsManager() {
  const [statements, setStatements] = useState<StatementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [noteEditorId, setNoteEditorId] = useState<string | null>(null)
  const [notesById, setNotesById] = useState<Record<string, string>>({})

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
          status,
          label_notes,
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

      const rows = (data ?? []) as StatementRow[]
      setStatements(rows)
      setNotesById(
        rows.reduce<Record<string, string>>((acc, row) => {
          acc[row.id] = row.label_notes ?? ''
          return acc
        }, {}),
      )
      setLoading(false)
    }

    void fetchStatements()
    return () => {
      cancelled = true
    }
  }, [])

  const handleApprove = async (statementId: string) => {
    setApprovingId(statementId)

    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) throw new Error('Missing session')

      const response = await fetch(`/api/admin/sales-statements/${statementId}/approve`, {
        method: 'PATCH',
        headers: {
          Authorization: ['Bearer', session.access_token].join(' '),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: notesById[statementId] || undefined }),
      })

      const json = (await response.json().catch(() => null)) as
        | { statement?: { status: StatementStatus; labelNotes?: string } ; error?: string }
        | null

      const approvedStatement = json?.statement
      if (!response.ok || !approvedStatement) {
        throw new Error(json?.error ?? 'Approval failed')
      }

      setStatements((current) => current.map((statement) => {
        if (statement.id !== statementId) return statement
        return {
          ...statement,
          status: approvedStatement.status,
          label_notes: approvedStatement.labelNotes ?? notesById[statementId] ?? null,
        }
      }))
      setNoteEditorId(null)
      toast.success('Statement approved')
    } catch (approvalError) {
      toast.error(approvalError instanceof Error ? approvalError.message : 'Approval failed')
    } finally {
      setApprovingId(null)
    }
  }

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading statements" className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">Failed to load statements: {error}</p>
  }

  if (statements.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No statements uploaded yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Artist Name</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Amount (EUR)</TableHead>
            <TableHead>Filename</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statements.map((statement) => (
            <TableRow key={statement.id}>
              <TableCell>{statement.artists.name}</TableCell>
              <TableCell>{statement.period}</TableCell>
              <TableCell>
                <Badge variant={badgeVariant(statement.status)}>{statement.status}</Badge>
              </TableCell>
              <TableCell>{statement.amount_eur !== null ? `€${statement.amount_eur.toFixed(2)}` : '—'}</TableCell>
              <TableCell>
                <span className="font-mono text-xs">{statement.filename}</span>
              </TableCell>
              <TableCell>{new Date(statement.created_at).toLocaleString()}</TableCell>
              <TableCell className="space-y-2 text-right">
                <div className="flex justify-end gap-2">
                  {statement.status === 'draft' && (
                    <Button
                      disabled={approvingId === statement.id}
                      onClick={() => handleApprove(statement.id)}
                      size="sm"
                    >
                      Approve
                    </Button>
                  )}
                  <Button onClick={() => setNoteEditorId((current) => current === statement.id ? null : statement.id)} size="sm" variant="outline">
                    Reject / Notes
                  </Button>
                </div>
                {noteEditorId === statement.id && (
                  <Input
                    aria-label={`Label notes for ${statement.period}`}
                    className="ml-auto max-w-xs"
                    placeholder="Internal label notes"
                    value={notesById[statement.id] ?? ''}
                    onChange={(event) => setNotesById((current) => ({
                      ...current,
                      [statement.id]: event.target.value,
                    }))}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
