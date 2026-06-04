'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, PencilSimple, Trash, MagnifyingGlass, Archive, Star } from '@phosphor-icons/react'
import { useNews } from '@/hooks/useNews'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

type StatusFilter = 'all' | 'published' | 'draft' | 'scheduled' | 'archived'

const STATUS_BADGE: Record<NewsPost['status'], { label: string; className: string }> = {
  published: { label: 'Published', className: 'text-green-400 border-green-400/30' },
  draft: { label: 'Draft', className: 'text-muted-foreground border-border' },
  scheduled: { label: 'Scheduled', className: 'text-yellow-400 border-yellow-400/30' },
  archived: { label: 'Archived', className: 'text-orange-400 border-orange-400/30' },
}

export function NewsManager() {
  const router = useRouter()
  const { news, isLoading, updateNewsPost, deleteNewsPost } = useNews()
  const [deleteTarget, setDeleteTarget] = useState<NewsPost | null>(null)
  const [isMutating, setIsMutating] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return news
      .filter((p) => {
        if (statusFilter !== 'all' && p.status !== statusFilter) return false
        return !q || p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
      })
      .sort((a, b) => {
        const cmp = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
        return sortDir === 'desc' ? -cmp : cmp
      })
  }, [news, search, statusFilter, sortDir])

  const handleArchive = async (post: NewsPost) => {
    try {
      await updateNewsPost(post.id, { status: 'archived' })
      toast.success(`"${post.title}" archived`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Archive failed')
    }
  }

  const handleToggleFeatured = async (post: NewsPost) => {
    try {
      await updateNewsPost(post.id, { featured: !post.featured })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
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
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search posts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
          >
            Date {sortDir === 'desc' ? '↓' : '↑'}
          </Button>
          <Button size="sm" onClick={() => router.push('/admin/news/new')} className="gap-2">
            <Plus size={16} weight="bold" />
            New Post
          </Button>
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="all">All ({news.length})</TabsTrigger>
          <TabsTrigger value="published">Published ({news.filter((p) => p.status === 'published').length})</TabsTrigger>
          <TabsTrigger value="draft">Draft ({news.filter((p) => p.status === 'draft').length})</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled ({news.filter((p) => p.status === 'scheduled').length})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({news.filter((p) => p.status === 'archived').length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Audience</TableHead>
            <TableHead title="Show in hero carousel">Featured</TableHead>
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
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                {search || statusFilter !== 'all' ? 'No posts match your filters.' : 'No posts yet. Click "New Post" to add one.'}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((post) => {
              const badge = STATUS_BADGE[post.status] ?? STATUS_BADGE['draft']
              return (
                <TableRow key={post.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    <span className="flex items-center gap-1.5">
                      {post.featured && <Star size={12} weight="fill" className="text-yellow-400 shrink-0" aria-label="Featured" />}
                      {post.title}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{post.slug}</TableCell>
                  <TableCell>{post.publishedAt.split('T')[0]}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`gap-1 ${badge.className}`}>
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell>{post.isPressOnly ? 'Press' : 'Public'}</TableCell>
                  <TableCell>
                    <Switch
                      checked={post.featured}
                      onCheckedChange={() => void handleToggleFeatured(post)}
                      aria-label={`Toggle featured for "${post.title}"`}
                      title="Show in hero carousel"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => router.push(`/admin/news/${post.id}`)}
                        title="Edit"
                      >
                        <PencilSimple size={16} />
                      </Button>
                      {post.status !== 'archived' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => void handleArchive(post)}
                          title="Archive"
                          className="text-orange-400 hover:text-orange-400"
                        >
                          <Archive size={16} />
                        </Button>
                      )}
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
              )
            })
          )}
        </TableBody>
      </Table>

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
