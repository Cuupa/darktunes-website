'use client'

/**
 * app/portal/releases/_components/ReleaseChecklist.tsx — Client Component (leaf)
 *
 * Shows each release as an expandable card with checklist.
 * Checkbox changes PATCH /api/portal/checklist via Bearer token.
 * Receives all data as props (IoC).
 */

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import { CaretDown, CaretUp, CheckCircle, Circle, MusicNotes } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import { PortalEmptyState } from '@/components/portal/PortalEmptyState'
import type { Dictionary } from '@/i18n/types'
import type { Release } from '@/types'
import type { ReleaseChecklist } from '@/lib/api/releaseChecklists'

interface ReleaseChecklistPanelProps {
  dict: Dictionary['portal']
  releases: Release[]
  releasedReleases?: Release[]
  checklistsByReleaseId: Record<string, ReleaseChecklist[]>
}

function Progress({ completed, total }: { completed: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        {completed}/{total}
      </span>
    </div>
  )
}

function ReleaseCard({
  dict,
  release,
  initialChecklist,
}: {
  dict: Dictionary['portal']
  release: Release
  initialChecklist: ReleaseChecklist[]
}) {
  const [open, setOpen] = useState(false)
  const [checklist, setChecklist] = useState(initialChecklist)
  const [saving, setSaving] = useState<string | null>(null)

  const completed = checklist.filter((c) => c.isCompleted).length

  const handleToggle = async (item: ReleaseChecklist) => {
    setSaving(item.id)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const res = await fetch('/api/portal/checklist', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ checklistId: item.id, isCompleted: !item.isCompleted }),
      })

      if (!res.ok) {
        toast.error(dict.releases_saveError)
        return
      }

      setChecklist((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, isCompleted: !c.isCompleted } : c)),
      )
    } catch {
      toast.error(dict.releases_saveError)
    } finally {
      setSaving(null)
    }
  }

  const typeBadgeVariant =
    release.type === 'album' ? 'default' : release.type === 'ep' ? 'secondary' : 'outline'

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-4 w-full text-left"
        >
          {/* Cover art */}
          <div className="relative w-14 h-14 shrink-0 rounded overflow-hidden bg-muted">
            {release.coverArt ? (
              <Image
                src={getOptimizedImageUrl(release.coverArt, 56)}
                alt={release.title}
                fill
                className="object-cover"
                sizes="56px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                —
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold truncate">{release.title}</p>
              <Badge variant={typeBadgeVariant} className="text-xs shrink-0 uppercase">
                {release.type}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{release.releaseDate}</p>
            {checklist.length > 0 && (
              <div className="mt-2 max-w-xs">
                <Progress completed={completed} total={checklist.length} />
              </div>
            )}
          </div>

          {/* Toggle */}
          <div className="shrink-0 text-muted-foreground">
            {open ? <CaretUp size={16} /> : <CaretDown size={16} />}
          </div>
        </button>
      </CardHeader>

      {open && (
        <CardContent className="pt-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {dict.releases_checklist}
          </p>
          {checklist.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dict.releases_noData}</p>
          ) : (
            <ul className="space-y-2">
              {checklist.map((item) => (
                <li key={item.id}>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving === item.id}
                    onClick={() => handleToggle(item)}
                    className="w-full justify-start gap-3 h-auto py-1.5 px-2 text-sm"
                    title={item.isCompleted ? dict.releases_taskUndo : dict.releases_taskDone}
                  >
                    {item.isCompleted ? (
                      <CheckCircle size={18} weight="fill" className="text-primary shrink-0" />
                    ) : (
                      <Circle size={18} className="text-muted-foreground shrink-0" />
                    )}
                    <span className={item.isCompleted ? 'line-through text-muted-foreground' : ''}>
                      {item.task}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function ReleaseChecklistPanel({
  dict,
  releases,
  releasedReleases = [],
  checklistsByReleaseId,
}: ReleaseChecklistPanelProps) {
  const [pastOpen, setPastOpen] = useState(false)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{dict.releases_heading}</h1>
        <Button asChild>
          <Link href="/portal/releases/new">{dict.releases_submit_new}</Link>
        </Button>
      </div>

      {releases.length === 0 && releasedReleases.length === 0 ? (
        <PortalEmptyState
          icon={MusicNotes}
          heading={dict.releases_noReleases}
          description={dict.releases_noData}
          action={{ label: dict.releases_submit_new, href: '/portal/releases/new' }}
        />
      ) : (
        <>
          {releases.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {dict.releases_upcoming_heading}
              </p>
              {releases.map((release) => (
                <ReleaseCard
                  key={release.id}
                  dict={dict}
                  release={release}
                  initialChecklist={checklistsByReleaseId[release.id] ?? []}
                />
              ))}
            </div>
          )}

          {releasedReleases.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider w-full text-left"
                onClick={() => setPastOpen((v) => !v)}
                aria-expanded={pastOpen}
              >
                {pastOpen ? <CaretUp size={14} aria-hidden="true" /> : <CaretDown size={14} aria-hidden="true" />}
                {dict.releases_past_heading} ({releasedReleases.length})
              </button>
              {pastOpen && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{dict.releases_past_desc}</p>
                  {releasedReleases.map((r) => (
                    <Card key={r.id} className="bg-card border-border">
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {r.artworkUrl ? (
                            <Image
                              src={getOptimizedImageUrl(r.artworkUrl, 48)}
                              alt={r.title}
                              width={40}
                              height={40}
                              className="rounded shrink-0 object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                              <MusicNotes size={18} className="text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{r.title}</p>
                            <p className="text-xs text-muted-foreground">{r.releaseDate}</p>
                          </div>
                          <Badge variant="secondary" className="shrink-0 text-xs capitalize">
                            {r.type?.replace('_', ' ')}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
