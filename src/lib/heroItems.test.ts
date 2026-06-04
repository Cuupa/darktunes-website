import { describe, expect, it } from 'vitest'
import type { NewsPost, Release } from '@/types'
import { selectHeroItems } from './heroItems'

const releaseA = { id: 'rel-a', title: 'A', featured: true } as Release
const releaseB = { id: 'rel-b', title: 'B', featured: true } as Release
const releaseC = { id: 'rel-c', title: 'C', featured: false } as Release

const newsA = { id: 'news-a', slug: 'news-a', title: 'News A' } as NewsPost
const newsB = { id: 'news-b', slug: 'news-b', title: 'News B' } as NewsPost

describe('selectHeroItems', () => {
  it('returns only featured releases when heroContentType is release', () => {
    const items = selectHeroItems(
      [releaseA, releaseB, releaseC],
      [newsA],
      { heroContentType: 'release', heroFeaturedId: '' },
    )

    expect(items).toEqual([releaseA, releaseB])
  })

  it('returns only the configured news item when heroContentType is news and heroFeaturedId is set', () => {
    const items = selectHeroItems(
      [releaseA],
      [newsA, newsB],
      { heroContentType: 'news', heroFeaturedId: 'news-b' },
    )

    expect(items).toEqual([newsB])
  })

  it('falls back to first release when no release is featured', () => {
    const items = selectHeroItems(
      [releaseC],
      [],
      { heroContentType: 'release', heroFeaturedId: '' },
    )

    expect(items).toEqual([releaseC])
  })
})
