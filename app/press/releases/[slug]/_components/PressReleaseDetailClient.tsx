'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { Badge } from '@/components/ui/badge'
import { MarkdownContent } from '@/components/MarkdownContent'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { NewsPost } from '@/types'

interface PressReleaseDetailClientProps {
  post: NewsPost
}

type PressReleaseCategoryKey = 'albumAnnouncement' | 'tour' | 'labelNews' | 'other'

function renderCategory(category?: string | null): PressReleaseCategoryKey | null {
  if (!category) return null
  const normalized = category.toLowerCase().replace(/\s+/g, '')
  if (normalized === 'albumannouncement') return 'albumAnnouncement'
  if (normalized === 'labelnews') return 'labelNews'
  if (normalized === 'tour') return 'tour'
  return 'other'
}

export function PressReleaseDetailClient({ post }: PressReleaseDetailClientProps) {
  const t = useTranslations('pressReleases')
  const categoryKey = renderCategory(post.releaseCategory)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/press/dashboard/press-releases"
          className="inline-flex min-h-[44px] items-center text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          {t('detail.backLink')}
        </Link>

        {post.imageUrl && (
          <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-border">
            <Image
              src={getOptimizedImageUrl(post.imageUrl, 1400)}
              alt={`${post.title} – press release cover`}
              fill
              priority
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString()}</time>
            {categoryKey && <Badge variant="secondary">{t(`categories.${categoryKey}`)}</Badge>}
          </div>
          <h1 className="text-4xl font-bold tracking-tight">{post.title}</h1>
          {post.excerpt && <p className="border-l-2 border-primary pl-4 text-lg text-muted-foreground">{post.excerpt}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {post.mediaContact && (
            <div className="rounded-2xl border border-border bg-card/70 p-4">
              <p className="text-sm font-medium text-foreground">{t('detail.mediaContact')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{post.mediaContact}</p>
            </div>
          )}
          {categoryKey && (
            <div className="rounded-2xl border border-border bg-card/70 p-4">
              <p className="text-sm font-medium text-foreground">{t('detail.category')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t(`categories.${categoryKey}`)}</p>
            </div>
          )}
        </div>

        {post.embargoUntil && (
          <div className="rounded-2xl border border-secondary/40 bg-secondary/10 p-4 text-sm text-foreground">
            <span className="font-medium">{t('detail.embargo')}: </span>
            <time dateTime={post.embargoUntil}>{new Date(post.embargoUntil).toLocaleString()}</time>
          </div>
        )}

        <article className="rounded-3xl border border-border bg-card/60 p-6">
          {post.content.trimStart().startsWith('<') ? (
            <div
              className="prose prose-invert prose-sm max-w-none"
              suppressHydrationWarning
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
            />
          ) : (
            <MarkdownContent content={post.content} className="max-w-none" />
          )}
        </article>
      </div>
    </div>
  )
}