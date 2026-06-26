import { describe, expect, it } from 'vitest'
import type { NewsPost, Release } from '@/types'
import {
  MAX_HERO_FEATURES,
  collectHeroCandidates,
  computeHeroFeaturedEnforcement,
  previewFeaturedBump,
  resolveFeaturedUntilInput,
} from './heroFeatured'

const baseRelease = {
  isVisible: true,
  isPromo: false,
  releaseDate: '2024-01-01',
} as Release

const baseNews = {
  status: 'published',
  publishedAt: '2024-01-01',
} as NewsPost

describe('collectHeroCandidates', () => {
  it('returns featured releases and news sorted by date descending', () => {
    const releases = [
      { ...baseRelease, id: 'r1', title: 'R1', featured: true, releaseDate: '2024-06-01' },
      { ...baseRelease, id: 'r2', title: 'R2', featured: false, releaseDate: '2024-07-01' },
    ] as Release[]
    const news = [
      { ...baseNews, id: 'n1', title: 'N1', featured: true, publishedAt: '2024-08-01' },
    ] as NewsPost[]

    expect(collectHeroCandidates(releases, news).map((item) => item.id)).toEqual(['n1', 'r1'])
  })

  it('excludes expired featured items', () => {
    const releases = [
      {
        ...baseRelease,
        id: 'r1',
        title: 'Expired',
        featured: true,
        featuredUntil: '2020-01-01T00:00:00.000Z',
      },
    ] as Release[]

    expect(collectHeroCandidates(releases, [])).toEqual([])
  })
})

describe('previewFeaturedBump', () => {
  it('requires confirmation when activating an 11th hero item', () => {
    const releases = Array.from({ length: 6 }, (_, index) => ({
      ...baseRelease,
      id: `r${index}`,
      title: `Release ${index}`,
      featured: true,
      releaseDate: `2024-${String(index + 1).padStart(2, '0')}-01`,
    })) as Release[]
    const news = Array.from({ length: 4 }, (_, index) => ({
      ...baseNews,
      id: `n${index}`,
      title: `News ${index}`,
      featured: true,
      publishedAt: `2024-${String(index + 7).padStart(2, '0')}-15`,
    })) as NewsPost[]

    const preview = previewFeaturedBump(releases, news, { id: 'new', kind: 'release' })

    expect(preview.needsConfirm).toBe(true)
    expect(preview.bumpTarget?.id).toBe('r0')
    expect(preview.bumpTarget?.date).toBe('2024-01-01')
    expect(preview.message).toContain(String(MAX_HERO_FEATURES))
  })
})

describe('computeHeroFeaturedEnforcement', () => {
  it('marks expired and over-capacity no-duration items for removal', () => {
    const releases = Array.from({ length: 12 }, (_, index) => ({
      ...baseRelease,
      id: `r${index}`,
      title: `Release ${index}`,
      featured: true,
      releaseDate: `2024-${String(index + 1).padStart(2, '0')}-01`,
    })) as Release[]

    const updates = computeHeroFeaturedEnforcement(releases, [])
    const capacityUpdates = updates.filter((u) => u.featured_removed_reason === 'capacity')

    expect(capacityUpdates).toHaveLength(2)
    expect(capacityUpdates.map((u) => u.id).sort()).toEqual(['r0', 'r1'])
  })

  it('marks expired duration items separately', () => {
    const releases = [
      {
        ...baseRelease,
        id: 'r1',
        title: 'Expired',
        featured: true,
        featuredUntil: '2020-01-01T00:00:00.000Z',
      },
    ] as Release[]

    expect(computeHeroFeaturedEnforcement(releases, [])).toEqual([
      {
        id: 'r1',
        kind: 'release',
        featured: false,
        featured_removed_reason: 'expired',
      },
    ])
  })
})

describe('resolveFeaturedUntilInput', () => {
  it('returns null when featured is disabled or duration is off', () => {
    expect(
      resolveFeaturedUntilInput({
        featured: false,
        durationEnabled: true,
        durationMode: 'days',
        durationDays: 7,
      }),
    ).toBeNull()
  })

  it('computes an end timestamp from days', () => {
    const result = resolveFeaturedUntilInput({
      featured: true,
      durationEnabled: true,
      durationMode: 'days',
      durationDays: 7,
    })

    expect(result).toBeTruthy()
    expect(new Date(result!).getTime()).toBeGreaterThan(Date.now())
  })
})