import type { NewsPost, Release, SiteSettings } from '@/types'

function selectFeaturedReleases(releases: Release[]): Release[] {
  const featured = releases.filter((release) => release.featured)
  if (featured.length > 0) return featured
  return releases.length > 0 ? [releases[0]] : []
}

function selectFeaturedNews(news: NewsPost[], heroFeaturedId?: string): NewsPost | undefined {
  if (!news.length) return undefined
  if (!heroFeaturedId) return news[0]
  return news.find((post) => post.slug === heroFeaturedId || post.id === heroFeaturedId) ?? news[0]
}

export function selectHeroItems(
  releases: Release[],
  news: NewsPost[],
  siteSettings: Pick<SiteSettings, 'heroContentType' | 'heroFeaturedId'>,
): (Release | NewsPost)[] {
  const featuredReleases = selectFeaturedReleases(releases)
  const featuredNews = selectFeaturedNews(news, siteSettings.heroFeaturedId)

  if (siteSettings.heroContentType === 'news') {
    if (featuredNews) return [featuredNews]
    return featuredReleases
  }

  return featuredReleases
}

