import { describe, expect, it } from 'vitest'
import type { NewsPost, Release } from '@/types'
import { selectHeroItems } from './heroItems'

const releaseA = { id: 'rel-a', title: 'A', featured: true, isVisible: true, isPromo: false, releaseDate: '2024-06-01' } as Release
const releaseB = { id: 'rel-b', title: 'B', featured: true, isVisible: true, isPromo: false, releaseDate: '2024-05-01' } as Release
const releaseC = { id: 'rel-c', title: 'C', featured: false, isVisible: true, isPromo: false, releaseDate: '2024-04-01' } as Release

const newsA = { id: 'news-a', slug: 'news-a', title: 'News A', featured: true, status: 'published', publishedAt: '2024-07-01' } as NewsPost
const newsB = { id: 'news-b', slug: 'news-b', title: 'News B', featured: false, status: 'published', publishedAt: '2024-06-15' } as NewsPost
const newsC = { id: 'news-c', slug: 'news-c', title: 'News C', featured: true, status: 'draft', publishedAt: '2024-06-20' } as NewsPost

describe('selectHeroItems', () => {
  it('returns all featured visible non-promo releases and published featured news, sorted by date descending', () => {
    const items = selectHeroItems([releaseA, releaseB, releaseC], [newsA, newsB])

    // newsA (2024-07-01) > releaseA (2024-06-01) > releaseB (2024-05-01)
    expect(items).toEqual([newsA, releaseA, releaseB])
  })

  it('returns empty array when no items are featured', () => {
    const items = selectHeroItems([releaseC], [newsB])

    expect(items).toEqual([])
  })

  it('excludes draft or non-published featured news', () => {
    const items = selectHeroItems([], [newsC])

    expect(items).toEqual([])
  })

  it('excludes invisible or promo releases', () => {
    const invisibleRelease = { ...releaseA, isVisible: false } as Release
    const promoRelease = { ...releaseB, isPromo: true } as Release
    const items = selectHeroItems([invisibleRelease, promoRelease], [])

    expect(items).toEqual([])
  })

  it('accepts optional siteSettings parameter for backward compatibility', () => {
    const items = selectHeroItems(
      [releaseA],
      [newsA],
      { heroContentType: 'release', heroFeaturedId: '' },
    )

    expect(items).toEqual([newsA, releaseA])
  })
})
