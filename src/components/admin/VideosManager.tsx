'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, PencilSimple, Trash } from '@phosphor-icons/react'
import { useVideos } from '@/hooks/useVideos'
import { VideoForm, type VideoFormData } from './forms/VideoForm'
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
import type { Video } from '@/types'
import type { Database } from '@/types/database'

type VideoInsert = Database['public']['Tables']['videos']['Insert']

const EMPTY_FORM: VideoFormData = {
  title: '',
  artistName: '',
  youtubeId: '',
  thumbnailUrl: '',
  publishedAt: new Date().toISOString().split('T')[0],
}

function videoToFormData(video: Video): VideoFormData {
  return {
    title: video.title,
    artistName: video.artistName,
    youtubeId: video.youtubeId,
    thumbnailUrl: video.thumbnailUrl ?? '',
    publishedAt: video.publishedAt.split('T')[0],
  }
}

function formDataToInsert(data: VideoFormData): VideoInsert {
  return {
    title: data.title,
    artist_name: data.artistName,
    youtube_id: data.youtubeId,
    thumbnail_url: data.thumbnailUrl || null,
    published_at: data.publishedAt || new Date().toISOString(),
  }
}

export function VideosManager() {
  const { videos, isLoading, createVideo, updateVideo, deleteVideo } = useVideos()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVideo, setEditingVideo] = useState<Video | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Video | null>(null)
  const [isMutating, setIsMutating] = useState(false)

  const formValue = editingVideo ? videoToFormData(editingVideo) : EMPTY_FORM

  const openNew = () => {
    setEditingVideo(null)
    setDialogOpen(true)
  }

  const openEdit = (video: Video) => {
    setEditingVideo(video)
    setDialogOpen(true)
  }

  const handleSave = async (data: VideoFormData) => {
    setIsMutating(true)
    try {
      if (editingVideo) {
        await updateVideo(editingVideo.id, formDataToInsert(data))
        toast.success(`Updated "${data.title}"`)
      } else {
        await createVideo(formDataToInsert(data))
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
      await deleteVideo(deleteTarget.id)
      toast.success(`Deleted "${deleteTarget.title}"`)
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
        <p className="text-sm text-muted-foreground">{videos.length} video(s)</p>
        <Button size="sm" onClick={openNew} className="gap-2">
          <Plus size={16} weight="bold" />
          New Video
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Artist</TableHead>
            <TableHead>YouTube ID</TableHead>
            <TableHead>Published</TableHead>
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
          ) : videos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No videos yet. Click "New Video" to add one.
              </TableCell>
            </TableRow>
          ) : (
            videos.map((video) => (
              <TableRow key={video.id}>
                <TableCell className="font-medium">{video.title}</TableCell>
                <TableCell>{video.artistName}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {video.youtubeId}
                </TableCell>
                <TableCell>{video.publishedAt.split('T')[0]}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(video)} title="Edit">
                      <PencilSimple size={16} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteTarget(video)}
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVideo ? 'Edit Video' : 'New Video'}</DialogTitle>
          </DialogHeader>
          <VideoForm value={formValue} onChange={handleSave} isLoading={isMutating} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Video</AlertDialogTitle>
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
