import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, PencilSimple, Trash } from '@phosphor-icons/react'
import { useNews } from '@/hooks/useNews'
import { NewsForm, type NewsFormData } from './forms/NewsForm'
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
import type { NewsPost } from '@/types'
import type { Database } from '@/types/database'

type NewsInsert = Database['public']['Tables']['news_posts']['Insert']

const EMPTY_FORM: NewsFormData = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  imageUrl: '',
  publishedAt: new Date().toISOString().split('T')[0],
}

function newsPostToFormData(post: NewsPost): NewsFormData {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? '',
    content: post.content,
    imageUrl: post.imageUrl ?? '',
    publishedAt: post.publishedAt.split('T')[0],
  }
}

function formDataToInsert(data: NewsFormData): NewsInsert {
  return {
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt || null,
    content: data.content,
    image_url: data.imageUrl || null,
    published_at: data.publishedAt || new Date().toISOString(),
  }
}

export function NewsManager() {
  const { news, isLoading, createNewsPost, updateNewsPost, deleteNewsPost } = useNews()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<NewsPost | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NewsPost | null>(null)
  const [isMutating, setIsMutating] = useState(false)

  const formValue = editingPost ? newsPostToFormData(editingPost) : EMPTY_FORM

  const openNew = () => {
    setEditingPost(null)
    setDialogOpen(true)
  }

  const openEdit = (post: NewsPost) => {
    setEditingPost(post)
    setDialogOpen(true)
  }

  const handleSave = async (data: NewsFormData) => {
    setIsMutating(true)
    try {
      if (editingPost) {
        await updateNewsPost(editingPost.id, formDataToInsert(data))
        toast.success(`Updated "${data.title}"`)
      } else {
        await createNewsPost(formDataToInsert(data))
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
      await deleteNewsPost(deleteTarget.id)
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
        <p className="text-sm text-muted-foreground">{news.length} post(s)</p>
        <Button size="sm" onClick={openNew} className="gap-2">
          <Plus size={16} weight="bold" />
          New Post
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Published</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                Loading…
              </TableCell>
            </TableRow>
          ) : news.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                No posts yet. Click "New Post" to add one.
              </TableCell>
            </TableRow>
          ) : (
            news.map((post) => (
              <TableRow key={post.id}>
                <TableCell className="font-medium">{post.title}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {post.slug}
                </TableCell>
                <TableCell>{post.publishedAt.split('T')[0]}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(post)} title="Edit">
                      <PencilSimple size={16} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteTarget(post)}
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
            <DialogTitle>{editingPost ? 'Edit News Post' : 'New News Post'}</DialogTitle>
          </DialogHeader>
          <NewsForm value={formValue} onChange={handleSave} isLoading={isMutating} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete News Post</AlertDialogTitle>
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
