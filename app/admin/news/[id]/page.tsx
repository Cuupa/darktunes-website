'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { NewsForm, type NewsFormData } from '@/components/admin/forms/NewsForm'
import { useNews } from '@/hooks/useNews'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { NewsPost } from '@/types'

function newsPostToFormData(post: NewsPost): NewsFormData {
  // Normalize publishedAt to datetime-local format (YYYY-MM-DDTHH:mm)
  const dt = post.publishedAt ? new Date(post.publishedAt) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const localDt = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`

  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? '',
    content: post.content,
    imageUrl: post.imageUrl ?? '',
    heroBgUrl: post.heroBgUrl ?? '',
    publishedAt: localDt,
    scheduledAt: '',
    featured: post.featured ?? false,
    isPressOnly: post.isPressOnly ?? false,
    status: post.status,
    artistId: post.artistId ?? '',
    artistIds: post.artists?.map((a) => a.id) ?? (post.artistId ? [post.artistId] : []),
    embargoUntil: post.embargoUntil ? new Date(post.embargoUntil).toISOString().slice(0, 16) : '',
    mediaContact: post.mediaContact ?? '',
    releaseCategory: post.releaseCategory ?? '',
    heroPrimaryBtnLabel: post.heroPrimaryBtn?.label ?? '',
    heroPrimaryBtnAction: post.heroPrimaryBtn?.action ?? '',
    heroPrimaryBtnHref: post.heroPrimaryBtn?.href ?? '',
    heroSecondaryBtnLabel: post.heroSecondaryBtn?.label ?? '',
    heroSecondaryBtnAction: post.heroSecondaryBtn?.action ?? '',
    heroSecondaryBtnHref: post.heroSecondaryBtn?.href ?? '',
  }
}

export default function NewsEditPage() {
  const params = useParams()
  const router = useRouter()
  const postId = params['id'] as string

  const { news, isLoading, updateNewsPost } = useNews()
  const [isSaving, setIsSaving] = useState(false)

  const post = useMemo(() => news.find((n) => n.id === postId), [news, postId])
  const formValue = useMemo(() => (post ? newsPostToFormData(post) : null), [post])

  const handleSave = async (data: NewsFormData) => {
    if (!post) return
    setIsSaving(true)
    try {
      await updateNewsPost(post.id, {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt || null,
        content: data.content,
        image_url: data.imageUrl || null,
        hero_bg_url: data.heroBgUrl || null,
        published_at: data.publishedAt ? new Date(data.publishedAt).toISOString() : new Date().toISOString(),
        featured: data.featured,
        is_press_only: data.isPressOnly,
        status: data.status,
        artist_id: data.artistId || null,
        embargo_until: data.embargoUntil ? new Date(data.embargoUntil).toISOString() : null,
        media_contact: data.mediaContact || null,
        release_category: data.releaseCategory || null,
        hero_primary_btn_label: data.heroPrimaryBtnLabel || null,
        hero_primary_btn_action: data.heroPrimaryBtnAction || null,
        hero_primary_btn_href: data.heroPrimaryBtnHref || null,
        hero_secondary_btn_label: data.heroSecondaryBtnLabel || null,
        hero_secondary_btn_action: data.heroSecondaryBtnAction || null,
        hero_secondary_btn_href: data.heroSecondaryBtnHref || null,
      })
      // Update junction table: replace all entries for this post
      const supabase = createBrowserSupabaseClient()
      await supabase
        .from('news_post_artists' as const)
        .delete()
        .eq('news_post_id', post.id)
      if ((data.artistIds ?? []).length > 0) {
        const inserts = (data.artistIds ?? []).map((artistId, i) => ({
          news_post_id: post.id,
          artist_id: artistId,
          sort_order: i,
        }))
        await supabase.from('news_post_artists' as const).insert(inserts)
      }
      toast.success('News post saved')
      router.push('/admin/content?tab=news')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to Admin
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">
            {isLoading ? 'Loading…' : post ? `Edit: ${post.title}` : 'News post not found'}
          </h1>
        </div>

        {isLoading && (
          <Card>
            <CardContent className="space-y-4 pt-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        )}

        {!isLoading && formValue && (
          <Card>
            <CardHeader>
              <CardTitle>Edit News Post</CardTitle>
            </CardHeader>
            <CardContent>
              <NewsForm value={formValue} onChange={handleSave} isLoading={isSaving} />
            </CardContent>
          </Card>
        )}

        {!isLoading && !post && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">News post not found.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
