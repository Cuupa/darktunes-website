/**
 * Role-aware CMS navigation paths shared by /editor and whitelisted /admin pages.
 */

export type CmsAudience = 'admin' | 'editor'

export function getCmsHomePath(audience: CmsAudience): string {
  return audience === 'editor' ? '/editor' : '/admin'
}

export function getCmsTabPath(audience: CmsAudience, tab: string): string {
  return audience === 'editor' ? `/editor?tab=${tab}` : `/admin?tab=${tab}`
}

export function getCmsArtistsPath(audience: CmsAudience): string {
  return audience === 'editor' ? '/editor?tab=artists' : '/admin/artists'
}

export function getCmsNewsListPath(audience: CmsAudience): string {
  return audience === 'editor' ? '/editor?tab=news' : '/admin/news'
}

export function getCmsNewsEditPath(postId: string): string {
  return `/admin/news/${postId}`
}

export function getCmsNewsNewPath(): string {
  return '/admin/news/new'
}

export function getCmsArtistEditPath(artistId: string): string {
  return `/admin/artists/${artistId}/edit`
}

export function getCmsPromoLogPath(audience: CmsAudience): string {
  return audience === 'editor' ? '/editor?tab=promo-log' : '/admin/promo-log'
}

export function cmsAudienceFromRole(role: string | undefined): CmsAudience {
  return role === 'editor' ? 'editor' : 'admin'
}