'use client'

/**
 * src/components/admin/SystemHealthWidget.tsx
 *
 * Admin "System Health & API Status" dashboard widget.
 *
 * Displays:
 *   - Database connection status (Online / Offline)
 *   - Per-API last sync timestamp and status (auto-discovered from sync_logs)
 *   - Rate-limit warning badges
 *   - Error details for partial/error syncs
 *   - "Force Sync All" and "Sync YouTube" actions with loading states
 *
 * Props (IoC): receives the Bearer token from the parent (AuthContext) so
 * this component itself never reads auth state directly.
 */

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Database,
  CheckCircle,
  XCircle,
  Warning,
  ArrowsClockwise,
  Spinner,
  MusicNote,
  Microphone,
  Record as RecordIcon,
  Ticket,
  YoutubeLogo,
  Link,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useEffect } from 'react'

// ---------------------------------------------------------------------------
// Types (mirror HealthResponse from app/api/health/route.ts)
// ---------------------------------------------------------------------------

interface ApiHealthStatus {
  configured: boolean
  lastSyncAt: string | null
  lastSyncStatus: 'success' | 'partial' | 'error' | null
  rateLimited: boolean
  lastErrors: string[]
}

interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy'
  database: { status: 'online' | 'offline'; latencyMs: number | null }
  apis: Record<string, ApiHealthStatus>
  checkedAt: string
}

interface SystemHealthWidgetProps {
  /** Bearer token from the auth context — used to authenticate the sync call */
  bearerToken: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return 'Never'
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const API_META: Record<string, { label: string; icon: React.ReactNode }> = {
  itunes: { label: 'iTunes', icon: <MusicNote size={16} weight="bold" /> },
  spotify: { label: 'Spotify', icon: <Microphone size={16} weight="bold" /> },
  discogs: { label: 'Discogs', icon: <RecordIcon size={16} weight="bold" /> },
  songkick: { label: 'Songkick', icon: <Ticket size={16} weight="bold" /> },
  bandsintown: { label: 'Bandsintown', icon: <Ticket size={16} weight="bold" /> },
  youtube: { label: 'YouTube', icon: <YoutubeLogo size={16} weight="bold" /> },
  odesli: { label: 'Odesli', icon: <Link size={16} weight="bold" /> },
}

function getApiMeta(api: string): { label: string; icon: React.ReactNode } {
  return API_META[api] ?? { label: api.charAt(0).toUpperCase() + api.slice(1), icon: <MusicNote size={16} weight="bold" /> }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SystemHealthWidget({ bearerToken }: SystemHealthWidgetProps) {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncingYoutube, setSyncingYoutube] = useState(false)
  const [syncingApi, setSyncingApi] = useState<string | null>(null)
  const [expandedErrors, setExpandedErrors] = useState<string | null>(null)

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health')
      if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
      const data: HealthData = await res.json()
      setHealth(data)
    } catch (err) {
      toast.error(`Health check failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchHealth()
    // Refresh every 60 seconds
    const interval = setInterval(() => { void fetchHealth() }, 60_000)
    return () => clearInterval(interval)
  }, [fetchHealth])

  const handleForceSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
      })

      const data: unknown = await res.json()

      if (!res.ok) {
        const errorData = data as { error?: string }
        throw new Error(errorData.error ?? `Sync failed with status ${res.status}`)
      }

      const result = data as { totalErrors: number; results: Array<{ api: string; releasesUpserted: number; errors: string[] }> }

      if (result.totalErrors === 0) {
        toast.success('Sync completed successfully across all APIs.')
      } else {
        toast.warning(
          `Sync completed with ${result.totalErrors} error(s). Check the console for details.`,
        )
      }

      // Refresh health data after sync
      await fetchHealth()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('429')) {
        toast.error('Sync failed: Rate limit reached. Retrying automatically.')
      } else {
        toast.error(`Sync failed: ${message}`)
      }
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncYoutube = async () => {
    setSyncingYoutube(true)
    try {
      const res = await fetch('/api/sync-youtube', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
      })

      const data: unknown = await res.json()

      if (!res.ok) {
        const errorData = data as { error?: string }
        throw new Error(errorData.error ?? `YouTube sync failed with status ${res.status}`)
      }

      const result = data as { synced?: number; count?: number; message?: string }
      const syncedCount = result.synced ?? result.count
      if (typeof syncedCount === 'number') {
        toast.success(`YouTube sync completed (${syncedCount} video${syncedCount === 1 ? '' : 's'} synced).`)
      } else {
        toast.success(result.message ?? 'YouTube sync completed successfully.')
      }
      await fetchHealth()
    } catch (err) {
      toast.error(`YouTube sync failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSyncingYoutube(false)
    }
  }

  const handleSyncApi = async (api: string) => {
    setSyncingApi(api)
    try {
      const res = await fetch('/api/sync-api', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiSource: api }),
      })

      const data: unknown = await res.json()

      if (!res.ok) {
        const errorData = data as { error?: string }
        throw new Error(errorData.error ?? `Sync failed with status ${res.status}`)
      }

      const meta = getApiMeta(api)
      toast.success(`${meta.label} sync completed.`)
      await fetchHealth()
    } catch (err) {
      toast.error(`${getApiMeta(api).label} sync failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSyncingApi(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (!health) return null

  const dbOnline = health.database.status === 'online'
  const apiEntries = Object.entries(health.apis) as [string, ApiHealthStatus][]

  return (
    <div className="space-y-6">
      {/* Overall status header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {health.status === 'healthy' && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">All systems operational</Badge>
          )}
          {health.status === 'degraded' && (
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
              <Warning size={12} className="mr-1" />
              Degraded — rate limits active
            </Badge>
          )}
          {health.status === 'unhealthy' && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
              <XCircle size={12} className="mr-1" />
              Unhealthy
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            Updated {formatRelativeTime(health.checkedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => { void handleSyncYoutube() }}
            disabled={syncingYoutube || !dbOnline}
            size="sm"
            variant="outline"
          >
            {syncingYoutube ? (
              <>
                <Spinner size={14} className="mr-2 animate-spin" />
                Syncing…
              </>
            ) : (
              <>
                <YoutubeLogo size={14} className="mr-2" />
                Sync YouTube
              </>
            )}
          </Button>
          <Button
            onClick={() => { void handleForceSync() }}
            disabled={syncing || !dbOnline}
            size="sm"
            variant="outline"
          >
            {syncing ? (
              <>
                <Spinner size={14} className="mr-2 animate-spin" />
                Syncing…
              </>
            ) : (
              <>
                <ArrowsClockwise size={14} className="mr-2" />
                Force Sync All
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Database card */}
      <Card className={dbOnline ? 'border-green-500/30' : 'border-red-500/30'}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database size={16} weight="bold" />
            Database
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {dbOnline ? (
              <CheckCircle size={20} weight="fill" className="text-green-400" />
            ) : (
              <XCircle size={20} weight="fill" className="text-red-400" />
            )}
            <span className="font-medium text-sm">
              {dbOnline ? 'Online' : 'Offline'}
            </span>
            {health.database.latencyMs !== null && (
              <span className="text-xs text-muted-foreground ml-auto">
                {health.database.latencyMs}ms
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Per-API cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {apiEntries.map(([api, status]) => {
          const meta = getApiMeta(api)
          const hasErrors = status.lastErrors.length > 0 && (status.lastSyncStatus === 'partial' || status.lastSyncStatus === 'error')
          const isExpanded = expandedErrors === api

          return (
            <Card
              key={api}
              className={
                status.rateLimited
                  ? 'border-yellow-500/30'
                  : status.lastSyncStatus === 'error'
                    ? 'border-red-500/30'
                    : status.lastSyncStatus === 'partial'
                      ? 'border-yellow-500/30'
                      : 'border-border'
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {meta.icon}
                  {meta.label}
                </CardTitle>
                <CardDescription className="text-xs">
                  {status.configured ? 'Configured' : 'Not configured'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Last sync */}
                <div className="text-xs text-muted-foreground">
                  Last sync:{' '}
                  <span className="text-foreground font-medium">
                    {formatRelativeTime(status.lastSyncAt)}
                  </span>
                </div>
                {api === 'discogs' && !status.lastSyncStatus && (
                  <p className="text-xs text-muted-foreground">
                    Runs as part of Spotify sync when artist has a Discogs ID set.
                  </p>
                )}
                {api === 'odesli' && !status.lastSyncStatus && (
                  <p className="text-xs text-muted-foreground">
                    Runs automatically after each successful Spotify release sync.
                  </p>
                )}

                {/* Status badge */}
                {status.lastSyncStatus && (
                  <Badge
                    className={
                      status.lastSyncStatus === 'success'
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : status.lastSyncStatus === 'partial'
                          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                    }
                  >
                    {status.lastSyncStatus}
                  </Badge>
                )}

                {/* Rate-limit warning */}
                {status.rateLimited && (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                    <Warning size={10} className="mr-1" />
                    Rate limited
                  </Badge>
                )}

                {/* Error details toggle */}
                {hasErrors && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setExpandedErrors(isExpanded ? null : api)}
                      className="text-xs text-red-400 underline underline-offset-2 hover:text-red-300"
                    >
                      {isExpanded ? 'Hide errors' : `Show ${status.lastErrors.length} error(s)`}
                    </button>
                    {isExpanded && (
                      <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                        {status.lastErrors.map((err, i) => (
                          <li key={i} className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1 font-mono break-all">
                            {err}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Force sync button */}
                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2"
                    disabled={!dbOnline || syncingApi === api || syncing}
                    onClick={() => handleSyncApi(api)}
                  >
                    {syncingApi === api ? (
                      <ArrowsClockwise size={10} className="mr-1 animate-spin" />
                    ) : (
                      <ArrowsClockwise size={10} className="mr-1" />
                    )}
                    Force Sync
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
