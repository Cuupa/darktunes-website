import { describe, expect, it } from 'vitest'
import type { NewsPost, Release } from '@/types'
import { selectHeroItems } from './heroFeatured'

const releaseA = { id: 'rel-a', title: 'A', featured: true, isVisible: true, isPromo: false, releaseDate: '2024-06-01' } as Release
const releaseB = { id: 'rel-b', title: 'B', featured: true, isVisible: true, isPromo: false, releaseDate: '2024-05-01' } as Release
const releaseC = { id: 'rel-c', title: 'C', featured: false, isVisible: true, isPromo: false, releaseDate: '2024-04-01' } as Release

const newsA = { id: 'news-a', slug: 'news-a', title: 'News A', featured: true, status: 'published', publishedAt: '2024-07-01' } as NewsPost
const newsB = { id: 'news-b', slug: 'news-b', title: 'News B', featured: false, status: 'published', publishedAt: '2024-06-15' } as NewsPost
const newsC = { id: 'news-c', slug: 'news-c', title: 'News C', featured: true, status: 'draft', publishedAt: '2024-06-20' } as NewsPost
const newsD = { id: 'news-d', slug: 'news-d', title: 'News D', featured: true, status: 'scheduled', publishedAt: '2024-07-05' } as NewsPost

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

  it('excludes draft or archived featured news', () => {
    const items = selectHeroItems([], [newsC])

    expect(items).toEqual([])
  })

  it('includes scheduled featured news with past publish date', () => {
    const items = selectHeroItems([], [newsD])

    expect(items).toEqual([newsD])
  })

  it('excludes invisible or promo releases', () => {
    const invisibleRelease = { ...releaseA, isVisible: false } as Release
    const promoRelease = { ...releaseB, isPromo: true } as Release
    const items = selectHeroItems([invisibleRelease, promoRelease], [])

    expect(items).toEqual([])
  })

  it('caps hero items at 10', () => {
    const releases = Array.from({ length: 8 }, (_, index) => ({
      ...releaseA,
      id: `rel-${index}`,
      releaseDate: `2024-0${index + 1}-01`,
    })) as Release[]
    const news = Array.from({ length: 5 }, (_, index) => ({
      ...newsA,
      id: `news-${index}`,
      publishedAt: `2024-1${index}-01`,
    })) as NewsPost[]

    expect(selectHeroItems(releases, news)).toHaveLength(10)
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
