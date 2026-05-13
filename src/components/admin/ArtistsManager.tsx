'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, PencilSimple, Trash, ArrowsClockwise, MagnifyingGlass, ArrowUp, ArrowDown } from '@phosphor-icons/react'
import { useArtists } from '@/hooks/useArtists'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { ArtistForm, type ArtistFormData } from './forms/ArtistForm'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import type { Artist } from '@/types'
import type { Database } from '@/types/database'

type ArtistInsert = Database['public']['Tables']['artists']['Insert']

const PAGE_SIZE = 20

type SortField = 'name' | 'country' | 'lastSyncedAt'
type SortDir = 'asc' | 'desc'

const EMPTY_FORM: ArtistFormData = {
  name: '',
  slug: '',
  bio: '',
  genres: '',
  imageUrl: '',
  logoUrl: '',
  spotifyUrl: '',
  appleMusicUrl: '',
  instagramUrl: '',
  youtubeUrl: '',
  websiteUrl: '',
  country: '',
  foundedYear: '',
  email: '',
  vatNumber: '',
  featured: false,
  isEuNonGerman: false,
  isVisible: true,
  notes: '',
  spotifyId: '',
  discogsId: '',
  songkickId: '',
  bandsintownId: '',
  facebookUrl: '',
  twitterUrl: '',
  tiktokUrl: '',
  bandcampUrl: '',
  shopUrl: '',
}

function artistToFormData(artist: Artist): ArtistFormData {
  return {
    name: artist.name,
    slug: artist.slug,
    bio: artist.bio ?? '',
    genres: artist.genres.join(', '),
    imageUrl: artist.imageUrl ?? '',
    logoUrl: artist.logoUrl ?? '',
    spotifyUrl: artist.spotifyUrl ?? '',
    appleMusicUrl: artist.appleMusicUrl ?? '',
    instagramUrl: artist.instagramUrl ?? '',
    youtubeUrl: artist.youtubeUrl ?? '',
    websiteUrl: artist.websiteUrl ?? '',
    country: artist.country ?? '',
    foundedYear: artist.foundedYear ? String(artist.foundedYear) : '',
    email: artist.email ?? '',
    vatNumber: artist.vatNumber ?? '',
    featured: artist.featured,
    isEuNonGerman: artist.isEuNonGerman ?? false,
    isVisible: artist.isVisible,
    notes: artist.notes ?? '',
    spotifyId: artist.spotifyId ?? '',
    discogsId: artist.discogsId ?? '',
    songkickId: artist.songkickId ?? '',
    bandsintownId: artist.bandsintownId ?? '',
    facebookUrl: artist.facebookUrl ?? '',
    twitterUrl: artist.twitterUrl ?? '',
    tiktokUrl: artist.tiktokUrl ?? '',
    bandcampUrl: artist.bandcampUrl ?? '',
    shopUrl: artist.shopUrl ?? '',
  }
}

function formDataToInsert(data: ArtistFormData): ArtistInsert {
  return {
    name: data.name,
    slug: data.slug,
    bio: data.bio || null,
    genres: data.genres
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean),
    image_url: data.imageUrl || null,
    logo_url: data.logoUrl || null,
    spotify_url: data.spotifyUrl || null,
    apple_music_url: data.appleMusicUrl || null,
    instagram_url: data.instagramUrl || null,
    youtube_url: data.youtubeUrl || null,
    website_url: data.websiteUrl || null,
    country: data.country || null,
    founded_year: data.foundedYear ? parseInt(data.foundedYear, 10) : null,
    email: data.email || null,
    vat_number: data.vatNumber || null,
    featured: data.featured,
    is_eu_non_german: data.isEuNonGerman,
    is_visible: data.isVisible,
    notes: data.notes || null,
    spotify_id: data.spotifyId || null,
    discogs_id: data.discogsId || null,
    songkick_id: data.songkickId || null,
    bandsintown_id: data.bandsintownId || null,
    facebook_url: data.facebookUrl || null,
    twitter_url: data.twitterUrl || null,
    tiktok_url: data.tiktokUrl || null,
    bandcamp_url: data.bandcampUrl || null,
    shop_url: data.shopUrl || null,
  }
}

/** Skeleton placeholder rows shown while artist data loads */
function ArtistSkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <Skeleton className="h-4 w-32" />
            </div>
          </TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell />
        </TableRow>
      ))}
    </>
  )
}

export function ArtistsManager() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { artists, isLoading, createArtist, updateArtist, deleteArtist, reload } = useArtists()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Artist | null>(null)
  const [isMutating, setIsMutating] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  // Search / sort / pagination
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(0)

  const formValue = editingArtist ? artistToFormData(editingArtist) : EMPTY_FORM

  // Derived: filtered + sorted + paginated list
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return artists.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      (a.country ?? '').toLowerCase().includes(q) ||
      a.genres.some((g) => g.toLowerCase().includes(q)),
    )
  }, [artists, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortField === 'country') cmp = (a.country ?? '').localeCompare(b.country ?? '')
      else if (sortField === 'lastSyncedAt') cmp = (a.lastSyncedAt ?? '').localeCompare(b.lastSyncedAt ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortField, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
    setPage(0)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="inline ml-1" aria-hidden="true" />
      : <ArrowDown size={12} className="inline ml-1" aria-hidden="true" />
  }

  const openNew = () => {
    setEditingArtist(null)
    setDialogOpen(true)
  }

  const openEdit = (artist: Artist) => {
    setEditingArtist(artist)
    setDialogOpen(true)
  }

  const handleSave = async (data: ArtistFormData) => {
    setIsMutating(true)
    try {
      if (editingArtist) {
        await updateArtist(editingArtist.id, formDataToInsert(data))
        toast.success(`Updated "${data.name}"`)
        setDialogOpen(false)
      } else {
        const newArtist = await createArtist(formDataToInsert(data))
        setDialogOpen(false)
        toast.success(`Created "${data.name}" — syncing releases…`)
        void handleSync(newArtist)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsMutating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsMutating(true)
    try {
      await deleteArtist(deleteTarget.id)
      toast.success(`Deleted "${deleteTarget.name}"`)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsMutating(false)
    }
  }

  const handleSync = async (artist: Artist) => {
    setSyncingId(artist.id)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const res = await fetch('/api/sync-artist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ artistId: artist.id }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Sync failed: ${text}`)
      }

      const result = (await res.json()) as { releasesUpserted: number; errors: string[] }
      if (result.errors.length > 0) {
        toast.warning(
          `Sync for "${artist.name}" completed with ${result.errors.length} error(s). ${result.releasesUpserted} release(s) synced.`,
        )
      } else {
        toast.success(`Sync complete for "${artist.name}": ${result.releasesUpserted} release(s) updated.`)
      }
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncingId(null)
    }
  }

  const handleToggleVisibility = async (artist: Artist) => {
    try {
      await updateArtist(artist.id, { is_visible: !artist.isVisible })
      toast.success(`"${artist.name}" is now ${!artist.isVisible ? 'visible' : 'hidden'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search artists…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="pl-8"
          />
        </div>
        <Select value={`${sortField}:${sortDir}`} onValueChange={(v) => {
          const [f, d] = v.split(':') as [SortField, SortDir]
          setSortField(f); setSortDir(d); setPage(0)
        }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Sort by…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name:asc">Name A → Z</SelectItem>
            <SelectItem value="name:desc">Name Z → A</SelectItem>
            <SelectItem value="country:asc">Country A → Z</SelectItem>
            <SelectItem value="lastSyncedAt:desc">Last synced (newest)</SelectItem>
            <SelectItem value="lastSyncedAt:asc">Last synced (oldest)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground whitespace-nowrap">{filtered.length} / {artists.length}</p>
        <Button size="sm" onClick={openNew} className="gap-2">
          <Plus size={16} weight="bold" />
          New Artist
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button type="button" className="hover:text-foreground" onClick={() => toggleSort('name')}>
                Name <SortIcon field="name" />
              </button>
            </TableHead>
            <TableHead>Genres</TableHead>
            <TableHead>
              <button type="button" className="hover:text-foreground" onClick={() => toggleSort('country')}>
                Country <SortIcon field="country" />
              </button>
            </TableHead>
            <TableHead>Visibility</TableHead>
            <TableHead>Featured</TableHead>
            <TableHead>
              <button type="button" className="hover:text-foreground" onClick={() => toggleSort('lastSyncedAt')}>
                Last Synced <SortIcon field="lastSyncedAt" />
              </button>
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <ArtistSkeletonRows />
          ) : paginated.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                {search ? `No artists match "${search}".` : 'No artists yet. Click "New Artist" to add one.'}
              </TableCell>
            </TableRow>
          ) : (
            paginated.map((artist) => (
              <TableRow key={artist.id}>
                <TableCell className="font-medium">{artist.name}</TableCell>
                <TableCell>{artist.genres.slice(0, 2).join(', ')}</TableCell>
                <TableCell>{artist.country ?? '—'}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => void handleToggleVisibility(artist)}
                    title={artist.isVisible ? 'Click to hide' : 'Click to show'}
                    className="focus:outline-none"
                  >
                    {artist.isVisible ? (
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
                  {artist.featured && <Badge variant="secondary">Featured</Badge>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {artist.lastSyncedAt
                    ? new Date(artist.lastSyncedAt).toLocaleDateString()
                    : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void handleSync(artist)}
                      disabled={syncingId === artist.id}
                      title="Sync Now"
                    >
                      <ArrowsClockwise
                        size={16}
                        className={syncingId === artist.id ? 'animate-spin' : ''}
                      />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(artist)} title="Edit">
                      <PencilSimple size={16} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteTarget(artist)}
                      title="Delete"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash size={16} />
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingArtist ? 'Edit Artist' : 'New Artist'}</DialogTitle>
          </DialogHeader>
          <ArtistForm value={formValue} onChange={handleSave} isLoading={isMutating} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Artist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will also
              permanently delete <strong>all their releases</strong>. This action cannot be undone.
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
    </div>
  )
}
