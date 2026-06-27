'use client'

/**
 * src/components/admin/SupportManager.tsx
 *
 * Admin support area: manual Zammad tickets, known-error filter, ticket audit log.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import {
  PaperPlaneTilt,
  ShieldCheck,
  WarningCircle,
  CheckCircle,
  Trash,
} from '@phosphor-icons/react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/clientErrors'
import type { ApiErrorResponse } from '@/lib/errors'
import type { Database } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type KnownErrorRow = Database['public']['Tables']['support_known_errors']['Row']
type TicketLogRow = Database['public']['Tables']['zammad_ticket_log']['Row']

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
}

function StatusBadge({ status }: { status: TicketLogRow['status'] }) {
  const styles: Record<TicketLogRow['status'], string> = {
    sent: 'bg-green-500/20 text-green-400 border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    skipped: 'bg-muted text-muted-foreground border-border',
    blocked_known: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    blocked_duplicate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    blocked_unconfigured: 'bg-muted text-muted-foreground border-border',
  }

  return (
    <Badge className={styles[status]}>
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}

export function SupportManager() {
  const tErrors = useTranslations('errors')
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [group, setGroup] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [knownErrors, setKnownErrors] = useState<KnownErrorRow[]>([])
  const [newFingerprint, setNewFingerprint] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [savingKnown, setSavingKnown] = useState(false)

  const [ticketLog, setTicketLog] = useState<TicketLogRow[]>([])

  const getToken = useCallback(async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')
    return session.access_token
  }, [supabase])

  const fetchStatus = useCallback(async () => {
    const token = await getToken()
    const res = await fetch('/api/admin/support/status', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const body = (await res.json()) as ApiErrorResponse
      throw new Error(getErrorMessage(body, tErrors))
    }
    const body = (await res.json()) as { configured: boolean; group: string | null }
    setConfigured(body.configured)
    setGroup(body.group)
  }, [getToken, tErrors])

  const fetchKnownErrors = useCallback(async () => {
    const token = await getToken()
    const res = await fetch('/api/admin/support/known-errors', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Failed to load known errors')
    const body = (await res.json()) as { items: KnownErrorRow[] }
    setKnownErrors(body.items)
  }, [getToken])

  const fetchTicketLog = useCallback(async () => {
    const token = await getToken()
    const res = await fetch('/api/admin/support/ticket-log?limit=50', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Failed to load ticket log')
    const body = (await res.json()) as { items: TicketLogRow[] }
    setTicketLog(body.items)
  }, [getToken])

  useEffect(() => {
    void Promise.all([fetchStatus(), fetchKnownErrors(), fetchTicketLog()])
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load support data'))
      .finally(() => setLoading(false))
  }, [fetchStatus, fetchKnownErrors, fetchTicketLog])

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) {
      toast.error('Subject and message are required')
      return
    }

    setSubmitting(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/support/tickets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      })
      if (!res.ok) {
        const body = (await res.json()) as ApiErrorResponse
        throw new Error(getErrorMessage(body, tErrors))
      }

      toast.success(
        configured
          ? 'Support request submitted — it will be delivered to Zammad shortly.'
          : 'Support request recorded. Zammad is not configured yet.',
      )
      setSubject('')
      setMessage('')
      void fetchTicketLog()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit ticket')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddKnownError = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFingerprint.trim() || !newLabel.trim()) {
      toast.error('Fingerprint and label are required')
      return
    }

    setSavingKnown(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/support/known-errors', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fingerprint: newFingerprint.trim(),
          label: newLabel.trim(),
          notes: newNotes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = (await res.json()) as ApiErrorResponse
        throw new Error(getErrorMessage(body, tErrors))
      }

      toast.success('Known error fingerprint added')
      setNewFingerprint('')
      setNewLabel('')
      setNewNotes('')
      await fetchKnownErrors()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add known error')
    } finally {
      setSavingKnown(false)
    }
  }

  const handleDeleteKnownError = async (id: string) => {
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin/support/known-errors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Known error removed')
      await fetchKnownErrors()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading support area…</p>
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <Alert variant={configured ? 'default' : 'destructive'}>
        {configured ? (
          <CheckCircle size={18} aria-hidden="true" />
        ) : (
          <WarningCircle size={18} aria-hidden="true" />
        )}
        <AlertTitle>
          Zammad {configured ? 'configured' : 'not configured'}
        </AlertTitle>
        <AlertDescription>
          {configured ? (
            <>Tickets are sent to the <strong>{group}</strong> group in Zammad.</>
          ) : (
            <>
              Set <code className="text-xs">ZAMMAD_URL</code> and{' '}
              <code className="text-xs">ZAMMAD_API_TOKEN</code> in your environment.
              The app continues to work normally without Zammad.
            </>
          )}
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="ticket">
        <TabsList aria-label="Support sections">
          <TabsTrigger value="ticket">New Ticket</TabsTrigger>
          <TabsTrigger value="known">Known Errors</TabsTrigger>
          <TabsTrigger value="log">Ticket Log</TabsTrigger>
        </TabsList>

        <TabsContent value="ticket" className="mt-4">
          <form onSubmit={handleSubmitTicket} className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div>
              <h2 className="text-lg font-semibold">Submit a support request</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your ticket is attributed to your account email and sent to Zammad in the background.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-subject">Subject</Label>
              <Input
                id="support-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                required
                placeholder="Brief summary of your question or issue"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-message">Message</Label>
              <Textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={10000}
                required
                rows={8}
                placeholder="Describe your question or concern in detail…"
              />
            </div>

            <Button type="submit" disabled={submitting} className="gap-2">
              <PaperPlaneTilt size={16} weight="bold" aria-hidden="true" />
              {submitting ? 'Submitting…' : 'Submit ticket'}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="known" className="mt-4 space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck size={22} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-semibold">Known error fingerprints</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Auto-generated system error tickets matching these fingerprints are suppressed.
                  Copy fingerprints from the Ticket Log after an error occurs.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddKnownError} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="known-fingerprint">Fingerprint (SHA-256)</Label>
                <Input
                  id="known-fingerprint"
                  value={newFingerprint}
                  onChange={(e) => setNewFingerprint(e.target.value)}
                  maxLength={128}
                  required
                  placeholder="64-character hex fingerprint"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="known-label">Label</Label>
                <Input
                  id="known-label"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  required
                  placeholder="e.g. Hydration mismatch in portal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="known-notes">Notes (optional)</Label>
                <Input
                  id="known-notes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Internal reference"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={savingKnown}>
                  {savingKnown ? 'Saving…' : 'Add fingerprint'}
                </Button>
              </div>
            </form>
          </div>

          {knownErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No known error fingerprints yet.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Fingerprint</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {knownErrors.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate" title={row.fingerprint}>
                        {row.fingerprint}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(row.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDeleteKnownError(row.id)}
                          aria-label={`Remove ${row.label}`}
                          className="min-h-[44px] min-w-[44px]"
                        >
                          <Trash size={16} aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          {ticketLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ticket submissions yet.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Fingerprint</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ticketLog.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                        {formatDate(row.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.ticket_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{row.customer_name ?? '—'}</div>
                        <div className="text-muted-foreground text-xs">{row.customer_email}</div>
                      </TableCell>
                      <TableCell className="text-sm max-w-[240px] truncate" title={row.title}>
                        {row.title}
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate" title={row.fingerprint ?? undefined}>
                        {row.fingerprint ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}