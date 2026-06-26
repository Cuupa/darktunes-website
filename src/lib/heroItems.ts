import type { NewsPost, Release, SiteSettings } from '@/types'
import { collectHeroCandidates, MAX_HERO_FEATURES } from '@/lib/heroFeatured'

export function selectHeroItems(
  releases: Release[],
  news: NewsPost[],
  _siteSettings?: Pick<SiteSettings, 'heroContentType' | 'heroFeaturedId'>,
): (Release | NewsPost)[] {
  const byId = new Map<string, Release | NewsPost>()
  for (const release of releases) byId.set(release.id, release)
  for (const post of news) byId.set(post.id, post)

  return collectHeroCandidates(releases, news)
    .slice(0, MAX_HERO_FEATURES)
    .map((item) => byId.get(item.id))
    .filter((item): item is Release | NewsPost => item != null)
}
