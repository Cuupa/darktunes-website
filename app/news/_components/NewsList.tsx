'use client'

import { useState } from 'react'
import { ArrowRight, Calendar, Newspaper } from '@phosphor-icons/react'
import Image from 'next/image'
import Link from 'next/link'
import { ContentPagination } from '@/components/ContentPagination'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { Dictionary } from '@/i18n/types'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { NewsPost } from '@/types'

const ITEMS_PER_PAGE = 6

interface NewsListProps {
  posts: NewsPost[]
  dict: Dictionary['newsPage']
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function NewsList({ posts, dict }: NewsListProps) {
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.ceil(posts.length / ITEMS_PER_PAGE)
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
  const featuredPost = currentPage === 1 ? posts[0] : null
  const pagePosts =
    currentPage === 1
      ? posts.slice(1, ITEMS_PER_PAGE)
      : posts.slice(startIdx, startIdx + ITEMS_PER_PAGE)

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-muted-foreground">
        <Newspaper size={48} weight="thin" />
        <p className="text-center font-serif">{dict.noNews}</p>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {featuredPost && (
        <article>
          <Card className="glow-card overflow-hidden border-border bg-card py-0 transition-all duration-300 hover:border-accent/50">
            <div className="grid gap-0 lg:grid-cols-[55%_45%]">
              {featuredPost.imageUrl && (
                <Link
                  href={`/news/${featuredPost.slug}`}
                  className="group relative block min-h-[320px] overflow-hidden aspect-[21/9] lg:min-h-[420px] lg:aspect-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Image
                    src={getOptimizedImageUrl(featuredPost.imageUrl, 1600)}
                    alt={featuredPost.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(min-width: 1024px) 55vw, 100vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/20" />
                </Link>
              )}
              <div className="flex flex-col justify-center p-6 lg:p-10">
                <Badge className="mb-4 w-fit bg-secondary/20 text-secondary-foreground uppercase tracking-[0.2em]">
                  Featured
                </Badge>
                <Badge className="mb-5 w-fit bg-primary/20 text-primary-foreground border-primary/30 uppercase font-mono tracking-widest">
                  <Calendar size={12} weight="bold" />
                  {formatDate(featuredPost.publishedAt)}
                </Badge>
                <h2 className="mb-4 text-3xl font-bold leading-tight lg:text-4xl">
                  <Link
                    href={`/news/${featuredPost.slug}`}
                    className="transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {featuredPost.title}
                  </Link>
                </h2>
                {featuredPost.excerpt && (
                  <p className="mb-6 font-serif leading-relaxed text-muted-foreground lg:text-lg">
                    {featuredPost.excerpt}
                  </p>
                )}
                <Link
                  href={`/news/${featuredPost.slug}`}
                  className="inline-flex min-h-[44px] items-center gap-2 self-start text-sm font-bold uppercase tracking-wider text-accent transition-colors hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {dict.readMore}
                  <ArrowRight weight="bold" />
                </Link>
              </div>
            </div>
          </Card>
        </article>
      )}

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {pagePosts.map((post) => (
          <article key={post.id}>
            <Card className="glow-card group h-full overflow-hidden border-border bg-card py-0 transition-all duration-300 hover:border-accent/50">
              {post.imageUrl && (
                <Link
                  href={`/news/${post.slug}`}
                  className="relative block aspect-video overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Image
                    src={getOptimizedImageUrl(post.imageUrl, 800)}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  />
                </Link>
              )}
              <div className="flex flex-1 flex-col p-6">
                <Badge className="mb-4 w-fit bg-primary/20 text-primary-foreground border-primary/30 uppercase font-mono tracking-widest">
                  <Calendar size={12} weight="bold" />
                  {formatDate(post.publishedAt)}
                </Badge>
                <h2 className="mb-3 text-xl font-bold leading-tight transition-colors group-hover:text-accent">
                  <Link
                    href={`/news/${post.slug}`}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {post.title}
                  </Link>
                </h2>
                {post.excerpt && (
                  <p className="flex-1 font-serif text-sm leading-relaxed text-muted-foreground line-clamp-3">
                    {post.excerpt}
                  </p>
                )}
                <Link
                  href={`/news/${post.slug}`}
                  className="mt-6 inline-flex min-h-[44px] items-center gap-2 self-start pt-2 text-sm font-bold uppercase tracking-wider text-accent transition-colors hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {dict.readMore}
                  <ArrowRight weight="bold" />
                </Link>
              </div>
            </Card>
          </article>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pt-8">
          <ContentPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => {
              setCurrentPage(page)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
        </div>
      )}
    </div>
  )
}
