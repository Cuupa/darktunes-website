import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, PencilSimple, Trash, ArrowsClockwise } from '@phosphor-icons/react'
import { useReleases } from '@/hooks/useReleases'
import { ReleaseForm, type ReleaseFormData } from './forms/ReleaseForm'
import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { Release } from '@/types'
import type { Database } from '@/types/database'

type ReleaseInsert = Database['public']['Tables']['releases']['Insert']

const EMPTY_FORM: ReleaseFormData = {
  title: '',
  artistName: '',
  releaseDate: '',
  type: 'single',
  coverArt: '',
  spotifyUrl: '',
  appleMusicUrl: '',
  youtubeUrl: '',
  featured: false,
}

function releaseToFormData(release: Release): ReleaseFormData {
  return {
    title: release.title,
    artistName: release.artistName,
    releaseDate: release.releaseDate,
    type: release.type,
    coverArt: release.coverArt ?? '',
    spotifyUrl: release.spotifyUrl ?? '',
    appleMusicUrl: release.appleMusicUrl ?? '',
    youtubeUrl: release.youtubeUrl ?? '',
    featured: release.featured,
  }
}

function formDataToInsert(data: ReleaseFormData): ReleaseInsert {
  return {
    title: data.title,
    artist_name: data.artistName,
    release_date: data.releaseDate,
    type: data.type,
    cover_art: data.coverArt || null,
    spotify_url: data.spotifyUrl || null,
    apple_music_url: data.appleMusicUrl || null,
    youtube_url: data.youtubeUrl || null,
    featured: data.featured,
  }
}

export function ReleasesManager() {
  const { releases, isLoading, isSyncing, syncProgress, createRelease, updateRelease, deleteRelease, syncFromItunes } = useReleases()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRelease, setEditingRelease] = useState<Release | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Release | null>(null)
  const [isMutating, setIsMutating] = useState(false)

  const formValue = editingRelease ? releaseToFormData(editingRelease) : EMPTY_FORM

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
        toast.success(`Updated "${data.title}"`)
      } else {
        await createRelease(formDataToInsert(data))
        toast.success(`Created "${data.title}"`)
      }
      setDialogOpen(false)
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
      await deleteRelease(deleteTarget.id)
      toast.success(`Deleted "${deleteTarget.title}"`)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsMutating(false)
    }
  }

  const handleSync = async () => {
    try {
      await syncFromItunes()
      toast.success('iTunes sync completed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card">
        <div className="flex-1">
          <p className="text-sm font-medium">iTunes Sync</p>
          <p className="text-xs text-muted-foreground">
            Fetch all releases from Apple iTunes for known artists
          </p>
        </div>
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
          {isSyncing ? `Syncing ${syncProgress}%` : 'Sync from iTunes'}
        </Button>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{releases.length} release(s)</p>
        <Button size="sm" onClick={openNew} className="gap-2">
          <Plus size={16} weight="bold" />
          New Release
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Artist</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Featured</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Loading…
              </TableCell>
            </TableRow>
          ) : releases.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No releases yet. Click "New Release" or sync from iTunes.
              </TableCell>
            </TableRow>
          ) : (
            releases.map((release) => (
              <TableRow key={release.id}>
                <TableCell className="font-medium">{release.title}</TableCell>
                <TableCell>{release.artistName}</TableCell>
                <TableCell>{release.releaseDate}</TableCell>
                <TableCell>
                  <Badge variant="outline">{release.type}</Badge>
                </TableCell>
                <TableCell>
                  {release.featured && <Badge variant="secondary">Featured</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(release)} title="Edit">
                      <PencilSimple size={16} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteTarget(release)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRelease ? 'Edit Release' : 'New Release'}</DialogTitle>
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
    </div>
  )
}
