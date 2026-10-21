import { describe, expect, it } from 'vitest'
import { mergeFanPageNews, type ArtistNewsPost } from './mergeNews'
import type { NewsPost } from '@/types'

function labelPost(id: string, at: string): NewsPost {
  return {
    id,
    title: `Label ${id}`,
    excerpt: 'ex',
    content: '<p>c</p>',
    publishedAt: at,
    slug: id,
    featured: false,
    isPressOnly: false,
    status: 'published',
  }
}

function artistPost(id: string, at: string): ArtistNewsPost {
  return {
    id,
    artistId: 'a1',
    title: `Band ${id}`,
    slug: id,
    excerpt: 'ex',
    content: '<p>c</p>',
    status: 'published',
    publishedAt: at,
    createdAt: at,
    updatedAt: at,
  }
}

describe('mergeFanPageNews', () => {
  it('merges and sorts newest first', () => {
    const merged = mergeFanPageNews(
      [labelPost('l1', '2026-01-01T00:00:00Z')],
      [artistPost('b1', '2026-02-01T00:00:00Z')],
    )
    expect(merged.map((p) => p.id)).toEqual(['b1', 'l1'])
    expect(merged[0].source).toBe('artist')
    expect(merged[1].href).toBe('/news/l1')
    expect(merged[0].href).toBeUndefined()
  })

  it('returns empty when both feeds are empty', () => {
    expect(mergeFanPageNews([], [])).toEqual([])
  })
})
