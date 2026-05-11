'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ContentPagination } from '@/components/ContentPagination'
import type { NewsPost } from '@/types'
import type { Dictionary } from '@/i18n/types'

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
  const pagePosts = posts.slice(startIdx, startIdx + ITEMS_PER_PAGE)

  if (posts.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-16 font-serif">{dict.noNews}</p>
    )
  }

  return (
    <div className="space-y-12">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {pagePosts.map((post) => (
          <article
            key={post.id}
            className="group bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-all duration-300 flex flex-col"
          >
            {post.imageUrl && (
              <div className="relative aspect-video overflow-hidden">
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>
            )}
            <div className="p-6 flex flex-col flex-1 space-y-3">
              <time
                dateTime={post.publishedAt}
                className="text-xs font-mono text-muted-foreground uppercase tracking-wider"
              >
                {formatDate(post.publishedAt)}
              </time>
              <h2 className="text-xl font-bold leading-tight group-hover:text-accent transition-colors">
                {post.title}
              </h2>
              {post.excerpt && (
                <p className="text-sm text-muted-foreground font-serif leading-relaxed line-clamp-3 flex-1">
                  {post.excerpt}
                </p>
              )}
              <Link
                href={`/news/${post.slug}`}
                className="inline-flex items-center text-sm font-medium text-accent hover:text-accent/80 transition-colors mt-auto pt-2"
              >
                {dict.readMore} →
              </Link>
            </div>
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
