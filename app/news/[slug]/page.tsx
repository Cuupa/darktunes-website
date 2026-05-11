/**
 * app/news/[slug]/page.tsx — News detail page [RSC]
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNewsPostBySlug } from '@/lib/api/news'
import { getDictionary, getLocale } from '@/i18n/getDictionary'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const client = await createServerSupabaseClient()
  const post = await getNewsPostBySlug(client, slug).catch(() => null)
  if (!post) return { title: 'Not Found' }
  return {
    title: `${post.title} — darkTunes Music Group`,
    description: post.excerpt,
  }
}

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function NewsDetailPage({ params }: Props) {
  const { slug } = await params
  const locale = await getLocale()
  const client = await createServerSupabaseClient()

  const [post, dict] = await Promise.all([
    getNewsPostBySlug(client, slug).catch(() => null),
    getDictionary(locale),
  ])

  if (!post) notFound()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 lg:px-8 py-24 max-w-3xl">
        <Link
          href="/news"
          className="text-sm text-muted-foreground hover:text-accent transition-colors mb-8 inline-block"
        >
          {dict.newsPage.backToNews}
        </Link>

        {post.imageUrl && (
          <div className="relative aspect-video overflow-hidden rounded-lg mb-8">
            <img
              src={post.imageUrl}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <time
          dateTime={post.publishedAt}
          className="text-xs font-mono text-muted-foreground uppercase tracking-wider"
        >
          {formatDate(post.publishedAt, locale)}
        </time>

        <h1 className="text-4xl lg:text-5xl font-bold mt-3 mb-6 tracking-tight leading-tight">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="text-xl text-muted-foreground font-serif leading-relaxed mb-8 border-l-2 border-primary pl-4">
            {post.excerpt}
          </p>
        )}

        <div className="prose prose-invert prose-sm max-w-none space-y-4">
          {post.content.split('\n\n').map((paragraph, idx) => (
            <p key={idx} className="text-foreground/90 leading-relaxed font-serif">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
