'use client'

/**
 * src/components/admin/RoleChangeHistory.tsx
 *
 * Displays a combined timeline of role-change and ban/unban audit records
 * for a single user, loaded on-demand from GET /api/admin/users/:id/role-history.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ClockCounterClockwise, ArrowRight, Prohibit, CheckCircle } from '@phosphor-icons/react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'
import { getErrorMessage } from '@/lib/clientErrors'
import type { ApiErrorResponse } from '@/lib/errors'
import type { RoleChangeRecord, BanRecord } from '@/types/users'

interface HistoryResponse {
  roleChanges: RoleChangeRecord[]
  banHistory: BanRecord[]
}

type CombinedEvent =
  | { kind: 'role'; record: RoleChangeRecord }
  | { kind: 'ban'; record: BanRecord }

interface Props {
  userId: string
}

export function RoleChangeHistory({ userId }: Props) {
  const tErrors = useTranslations('errors')
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Same-origin fetch: auth cookies are sent automatically
      const res = await fetch(`/api/admin/users/${userId}/role-history`)
      if (!res.ok) {
        const body = (await res.json()) as ApiErrorResponse
        throw new Error(getErrorMessage(body, tErrors))
      }
      setData((await res.json()) as HistoryResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : tErrors('SERVER_ERROR'))
    } finally {
      setIsLoading(false)
    }
  }, [userId, tErrors])

  useEffect(() => {
    void load()
  }, [load])

  // Merge and sort all events newest-first
  const events = useMemo<CombinedEvent[]>(() => {
    if (!data) return []
    const all: CombinedEvent[] = [
      ...data.roleChanges.map((r): CombinedEvent => ({ kind: 'role', record: r })),
      ...data.banHistory.map((r): CombinedEvent => ({ kind: 'ban', record: r })),
    ]
    return all.sort((a, b) => {
      const ta = a.record.changed_at
      const tb = b.record.changed_at
      return new Date(tb).getTime() - new Date(ta).getTime()
    })
  }, [data])

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 items-start">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive py-2">{error}</p>
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">No audit history found.</p>
    )
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-4 py-2">
      {events.map((event) => {
        if (event.kind === 'role') {
          const r = event.record
          return (
            <li key={`role-${r.id}`} className="ml-4">
              <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-muted ring-2 ring-background">
                <ClockCounterClockwise size={12} aria-hidden="true" />
              </span>
              <div className="text-sm">
                <span className="font-medium">Role changed: </span>
                <Badge variant="secondary" className="text-xs mr-1">{r.old_role}</Badge>
                <ArrowRight size={11} className="inline mx-0.5 text-muted-foreground" />
                <Badge variant="secondary" className="text-xs ml-1">{r.new_role}</Badge>
              </div>
              {r.reason && (
                <p className="text-xs text-muted-foreground mt-0.5">Reason: {r.reason}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                by {r.changed_by_email ?? r.changed_by} &middot;{' '}
                {new Date(r.changed_at).toLocaleString()}
              </p>
            </li>
          )
        }

        const r = event.record
        const isBan = r.banned
        return (
          <li key={`ban-${r.id}`} className="ml-4">
            <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-muted ring-2 ring-background">
              {isBan ? (
                <Prohibit size={12} className="text-amber-500" aria-hidden="true" />
              ) : (
                <CheckCircle size={12} className="text-green-400" aria-hidden="true" />
              )}
            </span>
            <div className="text-sm font-medium">
              {isBan ? 'User banned' : 'User unbanned'}
            </div>
            {r.reason && (
              <p className="text-xs text-muted-foreground mt-0.5">Reason: {r.reason}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              by {r.changed_by_email ?? r.changed_by} &middot;{' '}
              {new Date(r.changed_at).toLocaleString()}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
