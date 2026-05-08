import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, PencilSimple, Trash } from '@phosphor-icons/react'
import { useArtists } from '@/hooks/useArtists'
import { ArtistForm, type ArtistFormData } from './forms/ArtistForm'
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
import type { Artist } from '@/types'
import type { Database } from '@/types/database'

type ArtistInsert = Database['public']['Tables']['artists']['Insert']

const EMPTY_FORM: ArtistFormData = {
  name: '',
  slug: '',
  bio: '',
  genres: '',
  imageUrl: '',
  spotifyUrl: '',
  instagramUrl: '',
  youtubeUrl: '',
  websiteUrl: '',
  country: '',
  email: '',
  vatNumber: '',
  featured: false,
  isEuNonGerman: false,
  notes: '',
}

function artistToFormData(artist: Artist): ArtistFormData {
  return {
    name: artist.name,
    slug: artist.slug,
    bio: artist.bio ?? '',
    genres: artist.genres.join(', '),
    imageUrl: artist.imageUrl ?? '',
    spotifyUrl: artist.spotifyUrl ?? '',
    instagramUrl: artist.instagramUrl ?? '',
    youtubeUrl: artist.youtubeUrl ?? '',
    websiteUrl: artist.websiteUrl ?? '',
    country: artist.country ?? '',
    email: artist.email ?? '',
    vatNumber: artist.vatNumber ?? '',
    featured: artist.featured,
    isEuNonGerman: artist.isEuNonGerman ?? false,
    notes: artist.notes ?? '',
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
    spotify_url: data.spotifyUrl || null,
    instagram_url: data.instagramUrl || null,
    youtube_url: data.youtubeUrl || null,
    website_url: data.websiteUrl || null,
    country: data.country || null,
    email: data.email || null,
    vat_number: data.vatNumber || null,
    featured: data.featured,
    is_eu_non_german: data.isEuNonGerman,
    notes: data.notes || null,
  }
}

export function ArtistsManager() {
  const { artists, isLoading, createArtist, updateArtist, deleteArtist } = useArtists()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Artist | null>(null)
  const [isMutating, setIsMutating] = useState(false)

  const formValue = editingArtist ? artistToFormData(editingArtist) : EMPTY_FORM

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
      } else {
        await createArtist(formDataToInsert(data))
        toast.success(`Created "${data.name}"`)
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
      await deleteArtist(deleteTarget.id)
      toast.success(`Deleted "${deleteTarget.name}"`)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{artists.length} artist(s)</p>
        <Button size="sm" onClick={openNew} className="gap-2">
          <Plus size={16} weight="bold" />
          New Artist
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Genres</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Featured</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                Loading…
              </TableCell>
            </TableRow>
          ) : artists.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No artists yet. Click "New Artist" to add one.
              </TableCell>
            </TableRow>
          ) : (
            artists.map((artist) => (
              <TableRow key={artist.id}>
                <TableCell className="font-medium">{artist.name}</TableCell>
                <TableCell>{artist.genres.slice(0, 2).join(', ')}</TableCell>
                <TableCell>{artist.country ?? '—'}</TableCell>
                <TableCell>
                  {artist.featured && <Badge variant="secondary">Featured</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action
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
