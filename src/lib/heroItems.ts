import type { NewsPost, Release, SiteSettings } from '@/types'

export function selectHeroItems(
  releases: Release[],
  news: NewsPost[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _siteSettings?: Pick<SiteSettings, 'heroContentType' | 'heroFeaturedId'>,
): (Release | NewsPost)[] {
  const featuredReleases = releases.filter((r) => r.featured && r.isVisible && !r.isPromo)
  const featuredNews = news.filter((n) => n.featured && (n.status === 'published' || n.status === 'scheduled'))

  const allFeatured = [...featuredReleases, ...featuredNews].sort((a, b) => {
    const dateA = 'releaseDate' in a ? a.releaseDate : a.publishedAt
    const dateB = 'releaseDate' in b ? b.releaseDate : b.publishedAt
    return new Date(dateB).getTime() - new Date(dateA).getTime()
  })

  return allFeatured
}
