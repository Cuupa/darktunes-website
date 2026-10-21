import type { NewsPost } from '@/types'

export type FanPageNewsSource = 'label' | 'artist'

export interface FanPageNewsItem {
  id: string
  title: string
  excerpt: string
  content: string
  imageUrl?: string
  publishedAt: string
  slug: string
  href?: string
  source: FanPageNewsSource
}

export interface ArtistNewsPost {
  id: string
  artistId: string
  title: string
  slug: string
  excerpt: string
  content: string
  imageUrl?: string
  status: 'draft' | 'published'
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

export function mergeFanPageNews(
  labelPosts: NewsPost[],
  artistPosts: ArtistNewsPost[],
): FanPageNewsItem[] {
  const items: FanPageNewsItem[] = [
    ...labelPosts.map((post) => ({
      id: post.id,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      imageUrl: post.imageUrl,
      publishedAt: post.publishedAt,
      slug: post.slug,
      href: `/news/${post.slug}`,
      source: 'label' as const,
    })),
    ...artistPosts.map((post) => ({
      id: post.id,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      imageUrl: post.imageUrl,
      publishedAt: post.publishedAt ?? post.createdAt,
      slug: post.slug,
      source: 'artist' as const,
    })),
  ]
  return items.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )
}
