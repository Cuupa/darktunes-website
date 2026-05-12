'use client'

/**
 * src/components/admin/LogsManager.tsx
 *
 * Two-tab admin widget for Audit Log and Error Log.
 *
 * Audit Log — paginated view of all sync_logs entries.
 * Error Log  — only entries with status 'partial' or 'error', including error details.
 *
 * Data is fetched directly from Supabase (admin client) via the browser.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Warning, CheckCircle, XCircle, ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type SyncLogRow = Database['public']['Tables']['sync_logs']['Row']

const PAGE_SIZE = 20

function StatusBadge({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
        <CheckCircle size={10} weight="fill" aria-hidden="true" />
        success
      </Badge>
    )
  }
  if (status === 'partial') {
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
        <Warning size={10} weight="fill" aria-hidden="true" />
        partial
      </Badge>
    )
  }
  return (
    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
      <XCircle size={10} weight="fill" aria-hidden="true" />
      error
    </Badge>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
}

function parseErrors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return (raw as unknown[]).map((e) => (typeof e === 'string' ? e : JSON.stringify(e)))
}

interface LogTableProps {
  logs: SyncLogRow[]
  showErrors?: boolean
}

function LogTable({ logs, showErrors = false }: LogTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">No entries found.</p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>API</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Releases synced</TableHead>
          <TableHead>Rate limited</TableHead>
          {showErrors && <TableHead>Errors</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => {
          const errors = parseErrors(log.errors)
          const isExpanded = expandedRow === log.id
          return (
            <>
              <TableRow key={log.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(log.created_at)}
                </TableCell>
                <TableCell className="text-xs font-mono uppercase">{log.api_source}</TableCell>
                <TableCell>
                  <StatusBadge status={log.status} />
                </TableCell>
                <TableCell className="text-xs">{log.releases_synced}</TableCell>
                <TableCell className="text-xs">
                  {log.rate_limited ? (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Yes</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                {showErrors && (
                  <TableCell>
                    {errors.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                        className="text-xs text-red-400 underline underline-offset-2 hover:text-red-300"
                      >
                        {isExpanded ? 'Hide' : `${errors.length} error(s)`}
                      </button>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                )}
              </TableRow>
              {showErrors && isExpanded && errors.length > 0 && (
                <TableRow key={`${log.id}-errors`}>
                  <TableCell colSpan={6} className="bg-destructive/5 pb-3 pt-0">
                    <ul className="space-y-1 pl-2">
                      {errors.map((err, i) => (
                        <li key={i} className="text-xs text-destructive font-mono break-all bg-destructive/10 rounded px-2 py-1">
                          {err}
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                </TableRow>
              )}
            </>
          )
        })}
      </TableBody>
    </Table>
  )
}

interface LogsPanelProps {
  filter?: 'errors'
}

function LogsPanel({ filter }: LogsPanelProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [logs, setLogs] = useState<SyncLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('sync_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (filter === 'errors') {
        query = query.in('status', ['partial', 'error'])
      }

      const { data, count, error } = await query
      if (error) throw error
      setLogs(data ?? [])
      setTotal(count ?? 0)
    } catch {
      // Silently fail — RLS may block access
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [supabase, page, filter])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total} entr{total === 1 ? 'y' : 'ies'}
          {totalPages > 1 && ` · Page ${page + 1} of ${totalPages}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous page"
          >
            <ArrowLeft size={14} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            <ArrowRight size={14} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <LogTable logs={logs} showErrors={filter === 'errors'} />
        </div>
      )}
    </div>
  )
}

export function LogsManager() {
  return (
    <Tabs defaultValue="audit" className="space-y-4">
      <TabsList>
        <TabsTrigger value="audit">Audit Log</TabsTrigger>
        <TabsTrigger value="errors">Error Log</TabsTrigger>
      </TabsList>
      <TabsContent value="audit">
        <LogsPanel />
      </TabsContent>
      <TabsContent value="errors">
        <LogsPanel filter="errors" />
      </TabsContent>
    </Tabs>
  )
}
