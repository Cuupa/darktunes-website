'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NewsForm, type NewsFormData } from '@/components/admin/forms/NewsForm'
import { useNews } from '@/hooks/useNews'

const EMPTY_FORM: NewsFormData = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  imageUrl: '',
  publishedAt: new Date().toISOString().slice(0, 16),
  scheduledAt: '',
  featured: false,
  isPressOnly: false,
  status: 'draft',
  artistId: '',
  embargoUntil: '',
  mediaContact: '',
  releaseCategory: '',
  heroPrimaryBtnLabel: '',
  heroPrimaryBtnAction: '',
  heroPrimaryBtnHref: '',
  heroSecondaryBtnLabel: '',
  heroSecondaryBtnAction: '',
  heroSecondaryBtnHref: '',
}

export default function NewsNewPage() {
  const router = useRouter()
  const { createNewsPost } = useNews()
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (data: NewsFormData) => {
    setIsSaving(true)
    try {
      await createNewsPost({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt || null,
        content: data.content,
        image_url: data.imageUrl || null,
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
      toast.success(`Created "${data.title}"`)
      router.push('/admin?tab=news')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed')
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
          <h1 className="text-2xl font-bold">New News Post</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create News Post</CardTitle>
          </CardHeader>
          <CardContent>
            <NewsForm value={EMPTY_FORM} onChange={handleSave} isLoading={isSaving} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
