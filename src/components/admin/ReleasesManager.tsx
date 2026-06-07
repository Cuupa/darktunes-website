'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, PencilSimple, Trash, ArrowsClockwise, LinkSimple, Warning, MagnifyingGlass, ArrowUp, ArrowDown, CheckSquare } from '@phosphor-icons/react'
import { useReleases } from '@/hooks/useReleases'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { ReleaseForm, type ReleaseFormData } from './forms/ReleaseForm'
import { getOrCreateReleaseChecklist, toggleChecklistItem, type ReleaseChecklist } from '@/lib/api/releaseChecklists'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { Separator } from '@/components/ui/separator'
import { useDict } from '@/contexts/DictContext'
import { getErrorMessage } from '@/lib/clientErrors'
import type { ApiErrorResponse } from '@/lib/errors'
import type { Release } from '@/types'
import type { Database } from '@/types/database'
import type { SyncAllResult } from '@/lib/sync/syncAll'

type ReleaseInsert = Database['public']['Tables']['releases']['Insert']

const PAGE_SIZE = 20

type SortField = 'title' | 'artistName' | 'releaseDate' | 'type'
type SortDir = 'asc' | 'desc'

const EMPTY_FORM: ReleaseFormData = {
  title: '',
  artistName: '',
  artistIds: [],
  releaseDate: '',
  type: 'single',
  coverArt: '',
  spotifyUrl: '',
  appleMusicUrl: '',
  youtubeUrl: '',
  bandcampUrl: '',
  smartlinkUrl: '',
  featured: false,
  isVisible: true,
  isPromo: false,
  promoText: '',
  heroBgUrl: '',
  heroPrimaryBtnLabel: '',
  heroPrimaryBtnAction: 'default',
  heroPrimaryBtnHref: '',
  heroSecondaryBtnLabel: '',
  heroSecondaryBtnAction: 'default',
  heroSecondaryBtnHref: '',
}

function releaseToFormData(release: Release): ReleaseFormData {
  return {
    title: release.title,
    artistName: release.artistName,
    artistIds: release.artists?.map((a) => a.id) ?? (release.artistId ? [release.artistId] : []),
    releaseDate: release.releaseDate,
    type: release.type,
    coverArt: release.coverArt ?? '',
    spotifyUrl: release.spotifyUrl ?? '',
    appleMusicUrl: release.appleMusicUrl ?? '',
    youtubeUrl: release.youtubeUrl ?? '',
    bandcampUrl: release.bandcampUrl ?? '',
    smartlinkUrl: release.smartlinkUrl ?? '',
    featured: release.featured,
    isVisible: release.isVisible,
    isPromo: release.isPromo,
    promoText: release.promoText ?? '',
    heroBgUrl: release.heroBgUrl ?? '',
    heroPrimaryBtnLabel: release.heroPrimaryBtn?.label ?? '',
    heroPrimaryBtnAction: (release.heroPrimaryBtn?.action || 'default') as ReleaseFormData['heroPrimaryBtnAction'],
    heroPrimaryBtnHref: release.heroPrimaryBtn?.href ?? '',
    heroSecondaryBtnLabel: release.heroSecondaryBtn?.label ?? '',
    heroSecondaryBtnAction: (release.heroSecondaryBtn?.action || 'default') as ReleaseFormData['heroSecondaryBtnAction'],
    heroSecondaryBtnHref: release.heroSecondaryBtn?.href ?? '',
  }
}

function formDataToInsert(data: ReleaseFormData): ReleaseInsert {
  return {
    title: data.title,
    artist_id: (data.artistIds?.[0]) ?? null,
    release_date: data.releaseDate,
    type: data.type,
    cover_art: data.coverArt || null,
    spotify_url: data.spotifyUrl || null,
    apple_music_url: data.appleMusicUrl || null,
    youtube_url: data.youtubeUrl || null,
    bandcamp_url: data.bandcampUrl || null,
    smartlink_url: data.smartlinkUrl || null,
    featured: data.featured,
    is_visible: data.isVisible,
    is_promo: data.isPromo,
    promo_text: data.promoText || null,
    hero_bg_url: data.heroBgUrl || null,
    hero_primary_btn_label: data.heroPrimaryBtnLabel || null,
    hero_primary_btn_action: data.heroPrimaryBtnAction === 'default' ? null : data.heroPrimaryBtnAction,
    hero_primary_btn_href: data.heroPrimaryBtnHref || null,
    hero_secondary_btn_label: data.heroSecondaryBtnLabel || null,
    hero_secondary_btn_action: data.heroSecondaryBtnAction === 'default' ? null : data.heroSecondaryBtnAction,
    hero_secondary_btn_href: data.heroSecondaryBtnHref || null,
  }
}

export function ReleasesManager() {
  const dict = useDict()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { releases, isLoading, isSyncing, syncProgress, createRelease, updateRelease, deleteRelease, syncAllReleases } = useReleases()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRelease, setEditingRelease] = useState<Release | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Release | null>(null)
  const [isMutating, setIsMutating] = useState(false)
  const [resolvingSmartLinkId, setResolvingSmartLinkId] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<SyncAllResult | null>(null)
  const [isCleaningUp, setIsCleaningUp] = useState(false)

  // Checklist dialog
  const [checklistRelease, setChecklistRelease] = useState<Release | null>(null)
  const [checklistItems, setChecklistItems] = useState<ReleaseChecklist[]>([])
  const [checklistLoading, setChecklistLoading] = useState(false)

  // Search / sort / pagination
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('releaseDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  const formValue = editingRelease ? releaseToFormData(editingRelease) : EMPTY_FORM

  // Derived: filtered + sorted + paginated list
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return releases.filter((r) =>
      (r.title ?? '').toLowerCase().includes(q) ||
      (r.artistName ?? '').toLowerCase().includes(q) ||
      (r.type ?? '').toLowerCase().includes(q),
    )
  }, [releases, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortField === 'title') cmp = (a.title ?? '').localeCompare(b.title ?? '')
      else if (sortField === 'artistName') cmp = (a.artistName ?? '').localeCompare(b.artistName ?? '')
      else if (sortField === 'releaseDate') cmp = (a.releaseDate ?? '').localeCompare(b.releaseDate ?? '')
      else if (sortField === 'type') cmp = (a.type ?? '').localeCompare(b.type ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortField, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="inline ml-1" aria-hidden="true" />
      : <ArrowDown size={12} className="inline ml-1" aria-hidden="true" />
  }

  const openNew = () => {
    setEditingRelease(null)
    setDialogOpen(true)
  }

  const openEdit = (release: Release) => {
    setEditingRelease(release)
    setDialogOpen(true)
  }

  const handleSave = async (data: ReleaseFormData) => {
    setIsMutating(true)
    try {
      if (editingRelease) {
        await updateRelease(editingRelease.id, formDataToInsert(data))
        // Update junction table: replace all entries for this release
        await supabase
          .from('release_artists' as const)
          .delete()
          .eq('release_id', editingRelease.id)
        if ((data.artistIds ?? []).length > 0) {
          const inserts = (data.artistIds ?? []).map((artistId, i) => ({
            release_id: editingRelease.id,
            artist_id: artistId,
            sort_order: i,
          }))
          await supabase.from('release_artists' as const).insert(inserts)
        }
        toast.success(`Updated "${data.title}"`)
      } else {
        await createRelease(formDataToInsert(data))
        // Save junction table entries for newly created release
        if ((data.artistIds ?? []).length > 0) {
          const { data: row } = await supabase
            .from('releases')
            .select('id')
            .eq('title', data.title)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          if (row) {
            const inserts = (data.artistIds ?? []).map((artistId, i) => ({
              release_id: row.id,
              artist_id: artistId,
              sort_order: i,
            }))
            await supabase.from('release_artists' as const).insert(inserts)
          }
        }
        toast.success(`Created "${data.title}"`)
      }
      setDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.SERVER_ERROR)
    } finally {
      setIsMutating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsMutating(true)
    try {
      await deleteRelease(deleteTarget.id)
      toast.success(`Deleted "${deleteTarget.title}"`)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.SERVER_ERROR)
    } finally {
      setIsMutating(false)
    }
  }

  const handleSync = async () => {
    try {
      const result = await syncAllReleases()
      if (!result) {
        toast.info('Sync skipped — Supabase not configured')
        return
      }
      const totalSynced = result.results.reduce(
        (sum, r) => sum + r.releasesUpserted + r.concertsUpserted,
        0,
      )
      if (result.totalErrors === 0) {
        toast.success(`Sync completed: ${totalSynced} item(s) updated across all APIs`)
      } else {
        setSyncResult(result)
        toast.warning(
          `Sync completed with ${result.totalErrors} error(s). ${totalSynced} item(s) synced. Click "View Errors" to see details.`,
          { duration: 8000 },
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.SERVER_ERROR)
    }
  }

  const handleCleanupOrphaned = async () => {
    setIsCleaningUp(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error(dict.errors.AUTH_REQUIRED)

      const res = await fetch('/api/admin/cleanup-orphaned-releases', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!res.ok) {
        const body = (await res.json()) as ApiErrorResponse
        throw new Error(getErrorMessage(body, dict))
      }

      const { deleted } = (await res.json()) as { deleted: number }
      if (deleted > 0) {
        toast.success(`Deleted ${deleted} orphaned release(s)`)
      } else {
        toast.info('No orphaned releases found')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.SERVER_ERROR)
    } finally {
      setIsCleaningUp(false)
    }
  }

  const handleResolveSmartLink = async (release: Release) => {
    setResolvingSmartLinkId(release.id)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error(dict.errors.AUTH_REQUIRED)

      const res = await fetch('/api/admin/resolve-release-smart-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ releaseId: release.id }),
      })

      if (!res.ok) {
        const body = (await res.json()) as ApiErrorResponse
        throw new Error(getErrorMessage(body, dict))
      }

      const { smartUrl } = (await res.json()) as { smartUrl: string }
      toast.success(
        `Smart link resolved for "${release.title}": ${smartUrl.slice(0, 50)}…`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.SERVER_ERROR)
    } finally {
      setResolvingSmartLinkId(null)
    }
  }

  const handleToggleVisibility = async (release: Release) => {
    try {
      await updateRelease(release.id, { is_visible: !release.isVisible })
      toast.success(`"${release.title}" is now ${!release.isVisible ? 'visible' : 'hidden'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.SERVER_ERROR)
    }
  }

  const openChecklist = async (release: Release) => {
    setChecklistRelease(release)
    setChecklistLoading(true)
    setChecklistItems([])
    try {
      const items = await getOrCreateReleaseChecklist(supabase, release.artistId, release.id)
      setChecklistItems(items)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.SERVER_ERROR)
    } finally {
      setChecklistLoading(false)
    }
  }

  const handleToggleChecklistItem = async (item: ReleaseChecklist) => {
    try {
      const updated = await toggleChecklistItem(supabase, item.id, !item.isCompleted)
      setChecklistItems((prev) => prev.map((i) => i.id === updated.id ? updated : i))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.SERVER_ERROR)
    }
  }

  const handleMarkAllDone = async () => {
    const pending = checklistItems.filter((i) => !i.isCompleted)
    if (pending.length === 0) return
    try {
      const updated = await Promise.all(pending.map((i) => toggleChecklistItem(supabase, i.id, true)))
      setChecklistItems((prev) =>
        prev.map((i) => {
          const found = updated.find((u) => u.id === i.id)
          return found ?? i
        }),
      )
      toast.success('All checklist items marked as done')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.SERVER_ERROR)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card">
        <div className="flex-1">
          <p className="text-sm font-medium">Sync All APIs</p>
          <p className="text-xs text-muted-foreground">
            Aggregate releases from iTunes · Spotify · Discogs for all artists
          </p>
        </div>
        <div className="flex gap-2">
          {syncResult && syncResult.totalErrors > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-yellow-500 border-yellow-500/30"
              onClick={() => setSyncResult(syncResult)}
            >
              <Warning size={16} weight="bold" />
              {syncResult.totalErrors} Error(s)
            </Button>
          )}
          <Button
            onClick={handleCleanupOrphaned}
            disabled={isCleaningUp || isLoading}
            variant="outline"
            size="sm"
            className="gap-2"
            title="Delete releases with no linked artist"
          >
            <Trash size={16} weight="bold" />
            {isCleaningUp ? 'Cleaning…' : 'Clean Orphaned'}
          </Button>
          <Button
            onClick={handleSync}
            disabled={isSyncing || isLoading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <ArrowsClockwise
              size={16}
              className={isSyncing ? 'animate-spin' : ''}
              weight="bold"
            />
            {isSyncing ? `Syncing ${syncProgress}%` : 'Sync All APIs (iTunes · Spotify · Discogs)'}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search releases…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="pl-8"
          />
        </div>
        <Select value={`${sortField}:${sortDir}`} onValueChange={(v) => {
          const [f, d] = v.split(':') as [SortField, SortDir]
          setSortField(f); setSortDir(d); setPage(0)
        }}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Sort by…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="releaseDate:desc">Date (newest first)</SelectItem>
            <SelectItem value="releaseDate:asc">Date (oldest first)</SelectItem>
            <SelectItem value="title:asc">Title A → Z</SelectItem>
            <SelectItem value="title:desc">Title Z → A</SelectItem>
            <SelectItem value="artistName:asc">Artist A → Z</SelectItem>
            <SelectItem value="artistName:desc">Artist Z → A</SelectItem>
            <SelectItem value="type:asc">Type</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground whitespace-nowrap">{filtered.length} / {releases.length}</p>
        <Button size="sm" onClick={openNew} className="gap-2">
          <Plus size={16} weight="bold" />
          New Release
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button type="button" className="hover:text-foreground" onClick={() => { setSortField('title'); setSortDir(sortField === 'title' && sortDir === 'asc' ? 'desc' : 'asc'); setPage(0) }}>
                Title <SortIcon field="title" />
              </button>
            </TableHead>
            <TableHead>
              <button type="button" className="hover:text-foreground" onClick={() => { setSortField('artistName'); setSortDir(sortField === 'artistName' && sortDir === 'asc' ? 'desc' : 'asc'); setPage(0) }}>
                Artist <SortIcon field="artistName" />
              </button>
            </TableHead>
            <TableHead>
              <button type="button" className="hover:text-foreground" onClick={() => { setSortField('releaseDate'); setSortDir(sortField === 'releaseDate' && sortDir === 'asc' ? 'desc' : 'asc'); setPage(0) }}>
                Date <SortIcon field="releaseDate" />
              </button>
            </TableHead>
            <TableHead>
              <button type="button" className="hover:text-foreground" onClick={() => { setSortField('type'); setSortDir(sortField === 'type' && sortDir === 'asc' ? 'desc' : 'asc'); setPage(0) }}>
                Type <SortIcon field="type" />
              </button>
            </TableHead>
            <TableHead>Visibility</TableHead>
            <TableHead>Featured</TableHead>
            <TableHead>Promo</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                Loading…
              </TableCell>
            </TableRow>
          ) : paginated.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                {search ? `No releases match "${search}".` : 'No releases yet. Click "New Release" or sync from iTunes.'}
              </TableCell>
            </TableRow>
          ) : (
            paginated.map((release) => (
              <TableRow key={release.id}>
                <TableCell className="font-medium">{release.title}</TableCell>
                <TableCell>{release.artistName}</TableCell>
                <TableCell>{release.releaseDate}</TableCell>
                <TableCell>
                  <Badge variant="outline">{release.type}</Badge>
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => void handleToggleVisibility(release)}
                    title={release.isVisible ? 'Click to hide' : 'Click to show'}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {release.isVisible ? (
                      <Badge variant="outline" className="gap-1 text-green-400 border-green-400/30 cursor-pointer hover:opacity-70">
                        <Eye size={12} aria-hidden="true" />
                        Visible
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground border-border cursor-pointer hover:opacity-70">
                        <EyeSlash size={12} aria-hidden="true" />
                        Hidden
                      </Badge>
                    )}
                  </button>
                </TableCell>
                <TableCell>
                  {release.featured && <Badge variant="secondary">Featured</Badge>}
                </TableCell>
                <TableCell>
                  {release.isPromo && <Badge variant="secondary">Promo</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void handleResolveSmartLink(release)}
                      disabled={resolvingSmartLinkId === release.id || (!release.spotifyUrl && !release.appleMusicUrl)}
                      title={release.smartUrl ? 'Re-resolve Odesli smart link' : 'Resolve Odesli smart link'}
                      aria-label={release.smartUrl ? `Re-resolve Odesli smart link for ${release.title}` : `Resolve Odesli smart link for ${release.title}`}
                    >
                      <LinkSimple
                        size={16}
                        aria-hidden="true"
                        className={resolvingSmartLinkId === release.id ? 'animate-pulse' : ''}
                        weight={release.smartUrl ? 'fill' : 'regular'}
                      />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void openChecklist(release)}
                      title="Release checklist"
                      aria-label={`Release checklist for ${release.title}`}
                    >
                      <CheckSquare size={16} aria-hidden="true" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(release)} title="Edit" aria-label={`Edit ${release.title}`}>
                      <PencilSimple size={16} aria-hidden="true" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteTarget(release)}
                      title="Delete"
                      aria-label={`Delete ${release.title}`}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash size={16} aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} aria-labelledby="releases-form-dialog-title" className="sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle id="releases-form-dialog-title">{editingRelease ? 'Edit Release' : 'New Release'}</DialogTitle>
          </DialogHeader>
          <ReleaseForm value={formValue} onChange={handleSave} isLoading={isMutating} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Release</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isMutating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sync error details dialog */}
      <Dialog open={!!syncResult && syncResult.totalErrors > 0} onOpenChange={(open) => !open && setSyncResult(null)}>
        <DialogContent aria-labelledby="releases-sync-errors-title" className="sm:max-w-lg md:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle id="releases-sync-errors-title">Sync Errors ({syncResult?.totalErrors ?? 0})</DialogTitle>
            <DialogDescription>
              The following errors occurred during the last sync run. Successful items were still saved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {syncResult?.results.filter((r) => r.errors.length > 0).map((r) => (
              <div key={r.api} className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {r.api} — {r.releasesUpserted} synced, {r.errors.length} error(s)
                </p>
                <ul className="space-y-1">
                  {r.errors.map((err, i) => (
                    <li key={i} className="text-xs text-destructive bg-destructive/10 rounded px-3 py-1.5 font-mono break-all">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Release Checklist Dialog */}
      <Dialog open={!!checklistRelease} onOpenChange={(open) => !open && setChecklistRelease(null)}>
        <DialogContent aria-labelledby="checklist-dialog-title" className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle id="checklist-dialog-title">
              Release Checklist — {checklistRelease?.title}
            </DialogTitle>
            <DialogDescription>
              Track the completion of release tasks. Check off items as they are done.
            </DialogDescription>
          </DialogHeader>
          {checklistLoading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {checklistItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <Checkbox
                    id={`checklist-${item.id}`}
                    checked={item.isCompleted}
                    onCheckedChange={() => void handleToggleChecklistItem(item)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`checklist-${item.id}`}
                    className={`text-sm leading-snug cursor-pointer ${item.isCompleted ? 'line-through text-muted-foreground' : ''}`}
                  >
                    {item.task}
                  </label>
                </div>
              ))}
              {checklistItems.length === 0 && (
                <p className="text-sm text-muted-foreground">No checklist items found.</p>
              )}
              {checklistItems.some((i) => !i.isCompleted) && (
                <div className="pt-2 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleMarkAllDone()}
                    className="gap-2"
                  >
                    <CheckSquare size={14} aria-hidden="true" />
                    Mark all as done
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
