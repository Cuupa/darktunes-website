'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { TiptapEditor } from '@/components/admin/TiptapEditor'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { uploadArtistPhoto } from '@/lib/api/portalProfile'
import type { ArtistNewsPost } from '@/lib/fan-page/mergeNews'

interface ArtistNewsClientProps {
  artistId: string | null
  artistName: string | null
  initialPosts: ArtistNewsPost[]
}

function qs(artistId: string) {
  return `artist_id=${encodeURIComponent(artistId)}`
}

export function ArtistNewsClient({ artistId, artistName, initialPosts }: ArtistNewsClientProps) {
  const t = useTranslations('portal')
  const [posts, setPosts] = useState(initialPosts)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [publish, setPublish] = useState(false)
  const [saving, setSaving] = useState(false)

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setContent('')
    setImageUrl(null)
    setPublish(false)
  }

  function startEdit(post: ArtistNewsPost) {
    setEditingId(post.id)
    setTitle(post.title)
    setContent(post.content)
    setImageUrl(post.imageUrl ?? null)
    setPublish(post.status === 'published')
  }

  async function token(): Promise<string | null> {
    const supabase = createBrowserSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  async function save() {
    if (!artistId) return
    if (!title.trim()) {
      toast.error(t('artist_news_title_required'))
      return
    }
    const access = await token()
    if (!access) {
      toast.error(t('artist_news_error'))
      return
    }
    setSaving(true)
    try {
      const body = {
        title: title.trim(),
        content,
        image_url: imageUrl,
        status: publish ? 'published' : 'draft',
      }
      const url = editingId
        ? `/api/portal/artist-news/${editingId}?${qs(artistId)}`
        : `/api/portal/artist-news?${qs(artistId)}`
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { detail?: string; error?: string } | null
        toast.error(payload?.detail ?? payload?.error ?? t('artist_news_error'))
        return
      }
      const saved = (await res.json()) as {
        id: string
        artist_id: string
        title: string
        slug: string
        excerpt: string
        content: string
        image_url: string | null
        status: 'draft' | 'published'
        published_at: string | null
        created_at: string
        updated_at: string
      }
      const mapped: ArtistNewsPost = {
        id: saved.id,
        artistId: saved.artist_id,
        title: saved.title,
        slug: saved.slug,
        excerpt: saved.excerpt,
        content: saved.content,
        imageUrl: saved.image_url ?? undefined,
        status: saved.status,
        publishedAt: saved.published_at ?? undefined,
        createdAt: saved.created_at,
        updatedAt: saved.updated_at,
      }
      setPosts((prev) => {
        const without = prev.filter((p) => p.id !== mapped.id)
        return [mapped, ...without]
      })
      toast.success(t('artist_news_saved'))
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!artistId) return
    const access = await token()
    if (!access) return
    const res = await fetch(`/api/portal/artist-news/${id}?${qs(artistId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${access}` },
    })
    if (!res.ok) {
      toast.error(t('artist_news_error'))
      return
    }
    setPosts((prev) => prev.filter((p) => p.id !== id))
    if (editingId === id) resetForm()
    toast.success(t('artist_news_deleted'))
  }

  async function onPickImage(file: File) {
    if (!artistId) return
    const access = await token()
    if (!access) return
    try {
      const url = await uploadArtistPhoto(artistId, file, access, () => {})
      setImageUrl(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('artist_news_error'))
    }
  }

  if (!artistId) {
    return <p className="text-muted-foreground">{t('notLinked')}</p>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t('artist_news_heading')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('artist_news_subtitle', { artist: artistName ?? '' })}
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="space-y-2">
          <Label htmlFor="artist-news-title">{t('artist_news_title')}</Label>
          <Input id="artist-news-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t('artist_news_body')}</Label>
          <TiptapEditor compact value={content} onChange={setContent} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="artist-news-image">{t('artist_news_image')}</Label>
          <Input
            id="artist-news-image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void onPickImage(file)
            }}
          />
          {imageUrl ? (
            <p className="text-xs text-muted-foreground break-all">{imageUrl}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Switch id="artist-news-publish" checked={publish} onCheckedChange={setPublish} />
          <Label htmlFor="artist-news-publish">{t('artist_news_publish')}</Label>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? t('artist_news_saving') : t('artist_news_save')}
          </Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              {t('artist_news_new')}
            </Button>
          ) : null}
        </div>
      </div>

      {posts.length === 0 ? (
        <p className="text-muted-foreground">{t('artist_news_empty')}</p>
      ) : (
        <ul className="space-y-2">
          {posts.map((post) => (
            <li
              key={post.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{post.title}</p>
                <Badge variant={post.status === 'published' ? 'default' : 'outline'}>
                  {post.status === 'published' ? t('artist_news_published') : t('artist_news_draft')}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => startEdit(post)}>
                  {t('artist_news_edit')}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => void remove(post.id)}>
                  {t('artist_news_delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
