'use client'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Plus, PencilSimple, Trash, ArrowsClockwise, Eye, EyeSlash } from '@phosphor-icons/react'
import { useVideos } from '@/hooks/useVideos'
import { useArtists } from '@/hooks/useArtists'
import { VideoForm, type VideoFormData } from './forms/VideoForm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
type VideoFilter = 'all' | 'visible' | 'hidden' | 'shorts'

const EMPTY_FORM: VideoFormData = {
  title: '',
  artistName: '',
  youtubeId: '',
  thumbnailUrl: '',
  publishedAt: new Date().toISOString().split('T')[0],
  isVisible: true,
  isShort: false,
}

function videoToFormData(video: Video): VideoFormData {
  return {
    title: video.title,
    artistName: video.artistName,
    youtubeId: video.youtubeId,
    thumbnailUrl: video.thumbnailUrl ?? '',
    publishedAt: video.publishedAt.split('T')[0],
    isVisible: video.isVisible,
    isShort: video.isShort,
  }
}

function formDataToInsert(data: VideoFormData): VideoInsert {
  return {
    title: data.title,
    artist_name: data.artistName,
    youtube_id: data.youtubeId,
    thumbnail_url: data.thumbnailUrl || null,
    published_at: data.publishedAt || new Date().toISOString(),
    is_visible: data.isVisible,
    is_short: data.isShort,
  }
}

export function VideosManager() {
  const { videos, isLoading, createVideo, updateVideo, deleteVideo, syncYouTube } = useVideos()
  const { artists } = useArtists()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVideo, setEditingVideo] = useState<Video | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Video | null>(null)
  const [isMutating, setIsMutating] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [filter, setFilter] = useState<VideoFilter>('all')

  const filteredVideos = useMemo(() => {
    if (filter === 'visible') return videos.filter((v) => v.isVisible)
    if (filter === 'hidden') return videos.filter((v) => !v.isVisible)
    if (filter === 'shorts') return videos.filter((v) => v.isShort)
    return videos
  }, [videos, filter])

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

  const handleToggleVisibility = async (video: Video) => {
    try {
      await updateVideo(video.id, { is_visible: !video.isVisible })
      toast.success(`"${video.title}" is now ${!video.isVisible ? 'visible' : 'hidden'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    }
  }

  const handleSyncYouTube = async () => {
    setIsSyncing(true)
    try {
      const { synced } = await syncYouTube()
      toast.success(`YouTube sync complete: ${synced} video(s) updated`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'YouTube sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-sm text-muted-foreground flex-1">{filteredVideos.length} / {videos.length} video(s)</p>
        <Select value={filter} onValueChange={(v) => setFilter(v as VideoFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Videos</SelectItem>
            <SelectItem value="visible">Visible</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
            <SelectItem value="shorts">Shorts only</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleSyncYouTube()}
          disabled={isSyncing || isLoading}
          className="gap-2"
        >
          <ArrowsClockwise size={16} className={isSyncing ? 'animate-spin' : ''} weight="bold" />
          {isSyncing ? 'Syncing…' : 'Sync YouTube Channel'}
        </Button>
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
            <TableHead>Visibility</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Published</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Loading…
              </TableCell>
            </TableRow>
          ) : filteredVideos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No videos found. Click &ldquo;Sync YouTube Channel&rdquo; to import the latest videos, or
                &ldquo;New Video&rdquo; to add one manually.
              </TableCell>
            </TableRow>
          ) : (
            filteredVideos.map((video) => (
              <TableRow key={video.id}>
                <TableCell className="font-medium">{video.title}</TableCell>
                <TableCell>{video.artistName}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {video.youtubeId}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => void handleToggleVisibility(video)}
                    title={video.isVisible ? 'Click to hide' : 'Click to show'}
                    className="focus:outline-none"
                  >
                    {video.isVisible ? (
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
                  {video.isShort && <Badge variant="secondary">Short</Badge>}
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
        <DialogContent aria-describedby={undefined} className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVideo ? 'Edit Video' : 'New Video'}</DialogTitle>
          </DialogHeader>
          <VideoForm value={formValue} onChange={handleSave} isLoading={isMutating} artists={artists} />
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
