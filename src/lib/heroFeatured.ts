import type { NewsPost, Release } from '@/types'

export const MAX_HERO_FEATURES = 10

export type HeroFeaturedKind = 'release' | 'news'

export type HeroFeaturedItem = {
  id: string
  kind: HeroFeaturedKind
  title: string
  date: string
  featuredUntil?: string | null
}

export type FeaturedRemovedReason = 'expired' | 'capacity'

export function getHeroItemDate(item: Release | NewsPost): string {
  return 'releaseDate' in item ? item.releaseDate : item.publishedAt
}

export function isReleaseHeroEligible(release: Release, now = Date.now()): boolean {
  if (!release.featured || !release.isVisible || release.isPromo) return false
  if (release.featuredUntil && new Date(release.featuredUntil).getTime() <= now) return false
  return true
}

export function isNewsHeroEligible(post: NewsPost, now = Date.now()): boolean {
  if (!post.featured) return false
  if (post.status !== 'published' && post.status !== 'scheduled') return false
  if (post.featuredUntil && new Date(post.featuredUntil).getTime() <= now) return false
  return true
}

export function collectHeroCandidates(
  releases: Release[],
  news: NewsPost[],
  now = new Date(),
): HeroFeaturedItem[] {
  const items: HeroFeaturedItem[] = []

  for (const release of releases) {
    if (!isReleaseHeroEligible(release, now.getTime())) continue
    items.push({
      id: release.id,
      kind: 'release',
      title: release.title,
      date: release.releaseDate,
      featuredUntil: release.featuredUntil,
    })
  }

  for (const post of news) {
    if (!isNewsHeroEligible(post, now.getTime())) continue
    items.push({
      id: post.id,
      kind: 'news',
      title: post.title,
      date: post.publishedAt,
      featuredUntil: post.featuredUntil,
    })
  }

  return items.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}

export function previewFeaturedBump(
  releases: Release[],
  news: NewsPost[],
  activating: { id: string; kind: HeroFeaturedKind },
): { needsConfirm: boolean; bumpTarget: HeroFeaturedItem | null; message: string } {
  const candidates = collectHeroCandidates(releases, news)
  const alreadyActive = candidates.some(
    (item) => item.id === activating.id && item.kind === activating.kind,
  )

  if (alreadyActive || candidates.length < MAX_HERO_FEATURES) {
    return { needsConfirm: false, bumpTarget: null, message: '' }
  }

  const bumpTarget = candidates[candidates.length - 1] ?? null
  const message = bumpTarget
    ? `The hero carousel is limited to ${MAX_HERO_FEATURES} items. "${bumpTarget.title}" will be removed from the hero to make room. The content itself will remain available.`
    : ''

  return { needsConfirm: true, bumpTarget, message }
}

export type HeroFeaturedEnforcementUpdate = {
  id: string
  kind: HeroFeaturedKind
  featured: false
  featured_removed_reason: FeaturedRemovedReason
}

export function computeHeroFeaturedEnforcement(
  releases: Release[],
  news: NewsPost[],
  now = new Date(),
): HeroFeaturedEnforcementUpdate[] {
  const updates: HeroFeaturedEnforcementUpdate[] = []
  const nowMs = now.getTime()
  const expiredKeys = new Set<string>()

  for (const release of releases) {
    if (
      release.featured &&
      release.featuredUntil &&
      new Date(release.featuredUntil).getTime() <= nowMs
    ) {
      expiredKeys.add(`release:${release.id}`)
      updates.push({
        id: release.id,
        kind: 'release',
        featured: false,
        featured_removed_reason: 'expired',
      })
    }
  }

  for (const post of news) {
    if (
      post.featured &&
      post.featuredUntil &&
      new Date(post.featuredUntil).getTime() <= nowMs
    ) {
      expiredKeys.add(`news:${post.id}`)
      updates.push({
        id: post.id,
        kind: 'news',
        featured: false,
        featured_removed_reason: 'expired',
      })
    }
  }

  const activeReleases = releases.filter((r) => !expiredKeys.has(`release:${r.id}`))
  const activeNews = news.filter((n) => !expiredKeys.has(`news:${n.id}`))
  const candidates = collectHeroCandidates(activeReleases, activeNews, now)

  const noDuration = candidates.filter((item) => !item.featuredUntil)
  if (noDuration.length > MAX_HERO_FEATURES) {
    for (const item of noDuration.slice(MAX_HERO_FEATURES)) {
      updates.push({
        id: item.id,
        kind: item.kind,
        featured: false,
        featured_removed_reason: 'capacity',
      })
    }
  }

  return updates
}

export function resolveFeaturedUntilInput(options: {
  featured: boolean
  durationEnabled: boolean
  durationMode: 'days' | 'datetime'
  durationDays?: number
  untilLocal?: string
}): string | null {
  if (!options.featured || !options.durationEnabled) return null

  if (options.durationMode === 'days') {
    const days = options.durationDays ?? 0
    if (days <= 0) return null
    return new Date(Date.now() + days * 86_400_000).toISOString()
  }

  if (!options.untilLocal) return null
  const parsed = new Date(options.untilLocal)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}