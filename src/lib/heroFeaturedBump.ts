import type { HeroFeaturedItem } from '@/lib/heroFeatured'
import type { Database } from '@/types/database'

type ReleaseUpdate = Database['public']['Tables']['releases']['Update']
type NewsUpdate = Database['public']['Tables']['news_posts']['Update']

export function buildHeroBumpUpdate(): ReleaseUpdate & NewsUpdate {
  return {
    featured: false,
    featured_removed_reason: 'capacity',
    featured_until: null,
  }
}

export function buildHeroFeatureUpdate(options: {
  featured: boolean
  featuredUntil: string | null
}): ReleaseUpdate & NewsUpdate {
  if (!options.featured) {
    return {
      featured: false,
      featured_until: null,
      featured_removed_reason: null,
    }
  }

  return {
    featured: true,
    featured_until: options.featuredUntil,
    featured_removed_reason: null,
  }
}

export function bumpTargetLabel(item: HeroFeaturedItem): string {
  return item.kind === 'release' ? `release "${item.title}"` : `news "${item.title}"`
}