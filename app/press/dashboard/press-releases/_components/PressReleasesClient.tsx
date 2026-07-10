'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import type { NewsPost } from '@/types'
import { getOptimizedImageUrl } from '@/lib/imageUtils'

interface PressReleasesClientProps {
  posts: NewsPost[]
}

type PressReleaseCategoryKey = 'albumAnnouncement' | 'tour' | 'labelNews' | 'other'

function categoryKey(category?: string | null): PressReleaseCategoryKey {
  const normalized = (category ?? '').toLowerCase().replace(/\s+/g, '')
  if (normalized === 'albumannouncement') return 'albumAnnouncement'
  if (normalized === 'tour') return 'tour'
  if (normalized === 'labelnews') return 'labelNews'
  return 'other'
}

export function PressReleasesClient({ posts }: PressReleasesClientProps) {
  const t = useTranslations('pressReleases')
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | PressReleaseCategoryKey>('all')
  const [currentTimestamp] = useState(() => Date.now())

  const categories = useMemo(() => {
    return Array.from(new Set(posts.map((post) => categoryKey(post.releaseCategory))))
  }, [posts])

  const filteredPosts = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return posts.filter((post) => {
      const matchesQuery = !needle || [post.title, post.excerpt, post.content, post.releaseCategory]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle))
      const key = categoryKey(post.releaseCategory)
      const matchesCategory = activeCategory === 'all' || key === activeCategory
      return matchesQuery && matchesCategory
    })
  }, [activeCategory, posts, query])

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">{t('heading')}</h1>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search')} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory('all')}
            aria-pressed={activeCategory === 'all'}
          >
            {t('filterAll')}
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              variant={activeCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(category)}
              aria-pressed={activeCategory === category}
            >
              {t(`categories.${category}`)}
            </Button>
          ))}
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noResults')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredPosts.map((post) => {
            const embargoFuture = post.embargoUntil ? new Date(post.embargoUntil).getTime() > currentTimestamp : false
            const category = categoryKey(post.releaseCategory)
            return (
              <Card key={post.id} className="overflow-hidden border-border bg-card/70">
                {post.imageUrl && (
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <Image
                      src={getOptimizedImageUrl(post.imageUrl, 600)}
                      alt={`${post.title} – press release cover`}
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                )}
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{t(`categories.${category}`)}</Badge>
                    <time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString()}</time>
                    {embargoFuture && <Badge variant="destructive">{t('embargoBadge')}</Badge>}
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold leading-tight">{post.title}</h2>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{post.excerpt || post.content}</p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/press/releases/${post.slug}`}>{t('openRelease')}</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}