'use client'

/**
 * src/components/admin/LogsManager.tsx
 *
 * Admin log viewer with five tabs:
 *   1. Sync Log     — all sync_logs entries
 *   2. Sync Errors  — sync_logs with status partial/error
 *   3. App Errors   — app_logs entries (UI, R2, upload, Vercel, Supabase errors)
 *   4. RBAC Audit   — rbac_audit_log (role/permission changes)
 *   5. Admin Actions — admin_audit_log (general admin actions)
 *
 * Each panel has:
 *   - Full-text search (filters by message / api_source / source)
 *   - Source / status filter dropdowns
 *   - Pagination
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Warning,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  MagnifyingGlass,
  Info,
} from '@phosphor-icons/react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type RbacAuditRow   = Database['public']['Tables']['rbac_audit_log']['Row']
type AdminAuditRow  = Database['public']['Tables']['admin_audit_log']['Row']

type SyncLogRow = Database['public']['Tables']['sync_logs']['Row']
type AppLogRow  = Database['public']['Tables']['app_logs']['Row']

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
}

function SyncStatusBadge({ status }: { status: string }) {
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

function AppLevelBadge({ level }: { level: string }) {
  if (level === 'info') {
    return (
      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1">
        <Info size={10} weight="fill" aria-hidden="true" />
        info
      </Badge>
    )
  }
  if (level === 'warn') {
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
        <Warning size={10} weight="fill" aria-hidden="true" />
        warn
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

function parseErrors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return (raw as unknown[]).map((e) => (typeof e === 'string' ? e : JSON.stringify(e)))
}

// ---------------------------------------------------------------------------
// Pagination controls (reused by all panels)
// ---------------------------------------------------------------------------

interface PaginationProps {
  page: number
  total: number
  pageSize: number
  onPrev: () => void
  onNext: () => void
}

function Pagination({ page, total, pageSize, onPrev, onNext }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        {total} entr{total === 1 ? 'y' : 'ies'}
        {totalPages > 1 && ` · Page ${page + 1} of ${totalPages}`}
      </p>
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" disabled={page === 0} onClick={onPrev} aria-label="Previous page">
          <ArrowLeft size={14} />
        </Button>
        <Button size="icon" variant="ghost" disabled={page >= totalPages - 1} onClick={onNext} aria-label="Next page">
          <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sync logs panel (Audit Log + Error Log)
// ---------------------------------------------------------------------------

interface SyncLogsPanelProps {
  errorsOnly?: boolean
}

function SyncLogsPanel({ errorsOnly = false }: SyncLogsPanelProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [logs, setLogs]       = useState<SyncLogRow[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [source, setSource]   = useState('all')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('sync_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (errorsOnly) {
        query = query.in('status', ['partial', 'error'])
      }
      if (source && source !== 'all') {
        query = query.eq('api_source', source)
      }
      if (search.trim()) {
        query = query.or(
          `message.ilike.%${search.trim()}%,api_source.ilike.%${search.trim()}%`
        )
      }

      const { data, count, error } = await query
      if (error) throw error
      setLogs(data ?? [])
      setTotal(count ?? 0)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [supabase, page, errorsOnly, source, search])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [search, source])

  useEffect(() => { void fetchLogs() }, [fetchLogs])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search message or API…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="h-8 w-[150px] text-sm">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="itunes">iTunes</SelectItem>
            <SelectItem value="spotify">Spotify</SelectItem>
            <SelectItem value="discogs">Discogs</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="odesli">Odesli</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No entries found.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>API</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Releases synced</TableHead>
                <TableHead>Rate limited</TableHead>
                {errorsOnly && <TableHead>Errors</TableHead>}
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
                      <TableCell><SyncStatusBadge status={log.status} /></TableCell>
                      <TableCell className="text-xs">{log.releases_synced}</TableCell>
                      <TableCell className="text-xs">
                        {log.rate_limited ? (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Yes</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {errorsOnly && (
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
                    {errorsOnly && isExpanded && errors.length > 0 && (
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
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// App logs panel (R2, UI, Vercel, Supabase, etc.)
// ---------------------------------------------------------------------------

function AppLogsPanel() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [logs, setLogs]       = useState<AppLogRow[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [source, setSource]   = useState('all')
  const [level, setLevel]     = useState('all')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('app_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (source && source !== 'all') {
        query = query.eq('source', source)
      }
      if (level && level !== 'all') {
        query = query.eq('level', level as 'error' | 'warn' | 'info')
      }
      if (search.trim()) {
        query = query.or(
          `message.ilike.%${search.trim()}%,source.ilike.%${search.trim()}%`
        )
      }

      const { data, count, error } = await query
      if (error) throw error
      setLogs(data ?? [])
      setTotal(count ?? 0)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [supabase, page, source, level, search])

  useEffect(() => { setPage(0) }, [search, source, level])
  useEffect(() => { void fetchLogs() }, [fetchLogs])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search message or source…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="h-8 w-[140px] text-sm">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="r2">R2 / Storage</SelectItem>
            <SelectItem value="supabase">Supabase</SelectItem>
            <SelectItem value="upload">Upload</SelectItem>
            <SelectItem value="ui">UI</SelectItem>
            <SelectItem value="vercel">Vercel</SelectItem>
          </SelectContent>
        </Select>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="h-8 w-[120px] text-sm">
            <SelectValue placeholder="All levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No entries found.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const hasDetails =
                  log.details && typeof log.details === 'object' &&
                  Object.keys(log.details).length > 0
                const isExpanded = expandedRow === log.id
                return (
                  <>
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{log.source}</TableCell>
                      <TableCell><AppLevelBadge level={log.level} /></TableCell>
                      <TableCell className="text-xs max-w-xs truncate">{log.message}</TableCell>
                      <TableCell>
                        {hasDetails ? (
                          <button
                            type="button"
                            onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                          >
                            {isExpanded ? 'Hide' : 'Show'}
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasDetails && (
                      <TableRow key={`${log.id}-details`}>
                        <TableCell colSpan={5} className="bg-muted/30 pb-3 pt-0">
                          <pre className="text-xs font-mono break-all whitespace-pre-wrap bg-muted/50 rounded px-3 py-2">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RBAC Audit panel
// ---------------------------------------------------------------------------

const RBAC_ACTION_LABELS: Record<string, string> = {
  permission_change:         'Permission change',
  custom_role_created:       'Custom role created',
  custom_role_updated:       'Custom role updated',
  custom_role_deleted:       'Custom role deleted',
  custom_permission_created: 'Custom permission created',
  custom_permission_updated: 'Custom permission updated',
  custom_permission_deleted: 'Custom permission deleted',
}

function RbacAuditPanel() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [entries, setEntries]   = useState<RbacAuditRow[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(0)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = session?.access_token
        ? { Authorization: 'Bearer ' + session.access_token }
        : {}
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      const res = await fetch(`/api/admin/rbac-audit?${params.toString()}`, { headers })
      if (!res.ok) throw new Error('Failed to load RBAC audit log')
      const body = (await res.json()) as { data: RbacAuditRow[]; total: number }
      setEntries(body.data)
      setTotal(body.total)
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [supabase, page])

  useEffect(() => { setPage(0) }, [search])
  useEffect(() => { void fetchEntries() }, [fetchEntries])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.action.toLowerCase().includes(q) ||
        e.target_type.toLowerCase().includes(q) ||
        (e.target_id ?? '').toLowerCase().includes(q),
    )
  }, [entries, search])

  return (
    <div className="space-y-4">
      <div className="relative">
        <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Search action, target type, target id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No RBAC audit entries found.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => {
                const hasChanges = !!(entry.old_value || entry.new_value)
                const isExpanded = expanded === entry.id
                return (
                  <>
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(entry.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {RBAC_ACTION_LABELS[entry.action] ?? entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.target_type}</TableCell>
                      <TableCell className="text-xs font-mono">{entry.target_id ?? '—'}</TableCell>
                      <TableCell>
                        {hasChanges ? (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            onClick={() => setExpanded(isExpanded ? null : entry.id)}
                          >
                            {isExpanded ? 'Hide' : 'Show'}
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasChanges && (
                      <TableRow key={`${entry.id}-detail`}>
                        <TableCell colSpan={5} className="bg-muted/30 pb-3 pt-0">
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            {entry.old_value && (
                              <div>
                                <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Before</p>
                                <pre className="text-xs font-mono bg-muted/50 rounded px-2 py-1.5 break-all whitespace-pre-wrap">
                                  {JSON.stringify(entry.old_value, null, 2)}
                                </pre>
                              </div>
                            )}
                            {entry.new_value && (
                              <div>
                                <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">After</p>
                                <pre className="text-xs font-mono bg-muted/50 rounded px-2 py-1.5 break-all whitespace-pre-wrap">
                                  {JSON.stringify(entry.new_value, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin Actions panel (admin_audit_log)
// ---------------------------------------------------------------------------

function AdminActionsPanel() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [logs, setLogs]         = useState<AdminAuditRow[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(0)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [resource, setResource] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('admin_audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (resource && resource !== 'all') query = query.eq('resource', resource)
      if (search.trim()) {
        query = query.or(
          `action.ilike.%${search.trim()}%,resource.ilike.%${search.trim()}%,resource_id.ilike.%${search.trim()}%`,
        )
      }

      const { data, count, error } = await query
      if (error) throw error
      setLogs(data ?? [])
      setTotal(count ?? 0)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [supabase, page, resource, search])

  useEffect(() => { setPage(0) }, [search, resource])
  useEffect(() => { void fetchLogs() }, [fetchLogs])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search action or resource…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={resource} onValueChange={setResource}>
          <SelectTrigger className="h-8 w-[160px] text-sm">
            <SelectValue placeholder="All resources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All resources</SelectItem>
            <SelectItem value="artists">Artists</SelectItem>
            <SelectItem value="releases">Releases</SelectItem>
            <SelectItem value="news">News</SelectItem>
            <SelectItem value="videos">Videos</SelectItem>
            <SelectItem value="users">Users</SelectItem>
            <SelectItem value="settings">Settings</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No admin action entries found.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Resource ID</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const hasDetails =
                  log.details && typeof log.details === 'object' &&
                  Object.keys(log.details).length > 0
                const isExpanded = expanded === log.id
                return (
                  <>
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs capitalize">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.resource}</TableCell>
                      <TableCell className="text-xs font-mono">{log.resource_id ?? '—'}</TableCell>
                      <TableCell>
                        {hasDetails ? (
                          <button
                            type="button"
                            onClick={() => setExpanded(isExpanded ? null : log.id)}
                            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                          >
                            {isExpanded ? 'Hide' : 'Show'}
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasDetails && (
                      <TableRow key={`${log.id}-details`}>
                        <TableCell colSpan={5} className="bg-muted/30 pb-3 pt-0">
                          <pre className="text-xs font-mono break-all whitespace-pre-wrap bg-muted/50 rounded px-3 py-2">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function LogsManager() {
  return (
    <Tabs defaultValue="audit" className="space-y-4">
      <TabsList className="flex-wrap">
        <TabsTrigger value="audit">Sync Log</TabsTrigger>
        <TabsTrigger value="errors">Sync Errors</TabsTrigger>
        <TabsTrigger value="app">App Errors</TabsTrigger>
        <TabsTrigger value="rbac">RBAC Audit</TabsTrigger>
        <TabsTrigger value="actions">Admin Actions</TabsTrigger>
      </TabsList>
      <TabsContent value="audit">
        <SyncLogsPanel />
      </TabsContent>
      <TabsContent value="errors">
        <SyncLogsPanel errorsOnly />
      </TabsContent>
      <TabsContent value="app">
        <AppLogsPanel />
      </TabsContent>
      <TabsContent value="rbac">
        <RbacAuditPanel />
      </TabsContent>
      <TabsContent value="actions">
        <AdminActionsPanel />
      </TabsContent>
    </Tabs>
  )
}
