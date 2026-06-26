/**
 * src/lib/cache/publicQueries.ts
 *
 * Reusable `unstable_cache`-wrapped fetchers for publicly readable data.
 *
 * Each helper creates its own public Supabase client inside the cache callback
 * (safe: no Dynamic API calls) and provides a `.catch()` fallback so that a
 * failing Supabase connection stores an empty result in the Data Cache rather
 * than propagating an error on every subsequent request.
 *
 * Revalidation tags are shared with the admin-side on-demand revalidation so
 * that `revalidateTag('releases')` etc. works across all pages.
 */

import { unstable_cache } from 'next/cache'
import { revalidateTag } from 'next/cache'
import { cache } from 'react'
import { createPublicSupabaseClient } from '@/lib/supabase/publicClient'
import { getPublicReleases } from '@/lib/api/releases'
import { getPublicNewsPosts, publishScheduledNewsPosts } from '@/lib/api/news'
import { persistEmojiCleanup } from '@/lib/emojiCleanup'
import { enforceHeroFeaturedLimits } from '@/lib/heroFeaturedEnforcement'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getPublicVideos } from '@/lib/api/videos'
import { getPublicConcerts } from '@/lib/api/concerts'
import { getPublicArtists } from '@/lib/api/artists'
import { getSiteSettings } from '@/lib/api/siteSettings'
import type { Release, NewsPost, Video, Concert, Artist, SiteSettings } from '@/types'

const TTL = 60 // seconds

/** All public releases, cache-keyed to the `releases` tag. */
export const getCachedPublicReleases = cache(unstable_cache(
  async (): Promise<Release[]> => {
    try {
      const serviceDb = await createServiceRoleSupabaseClient()
      const featuredChanged = await enforceHeroFeaturedLimits(serviceDb)
      const emojiChanged = await persistEmojiCleanup(serviceDb)
      if (featuredChanged > 0) revalidateTag('releases')
      if (emojiChanged > 0) {
        revalidateTag('releases')
        revalidateTag('news')
        revalidateTag('artists')
        revalidateTag('site-settings')
      }
    } catch (err) {
      console.error('[getCachedPublicReleases] Maintenance failed:', err)
    }
    return getPublicReleases(createPublicSupabaseClient()).catch(() => [] as Release[])
  },
  ['public-releases'],
  { revalidate: TTL, tags: ['releases'] },
))

/** All public news posts, cache-keyed to the `news` tag. */
export const getCachedPublicNews = cache(unstable_cache(
  async (): Promise<NewsPost[]> => {
    try {
      const serviceDb = await createServiceRoleSupabaseClient()
      const publishedCount = await publishScheduledNewsPosts(serviceDb)
      const featuredChanged = await enforceHeroFeaturedLimits(serviceDb)
      const emojiChanged = await persistEmojiCleanup(serviceDb)
      if (publishedCount > 0 || featuredChanged > 0 || emojiChanged > 0) {
        revalidateTag('news')
      }
      if (featuredChanged > 0) revalidateTag('releases')
      if (emojiChanged > 0) {
        revalidateTag('releases')
        revalidateTag('artists')
        revalidateTag('site-settings')
      }
    } catch (err) {
      console.error('[getCachedPublicNews] Maintenance failed:', err)
    }
    return getPublicNewsPosts(createPublicSupabaseClient()).catch(() => [] as NewsPost[])
  },
  ['public-news'],
  { revalidate: TTL, tags: ['news'] },
))

/** All public videos, cache-keyed to the `videos` tag. */
export const getCachedPublicVideos = cache(unstable_cache(
  async (): Promise<Video[]> =>
    getPublicVideos(createPublicSupabaseClient()).catch(() => [] as Video[]),
  ['public-videos'],
  { revalidate: TTL, tags: ['videos'] },
))

/** All public concerts, cache-keyed to the `concerts` tag. */
export const getCachedPublicConcerts = cache(unstable_cache(
  async (): Promise<Concert[]> =>
    getPublicConcerts(createPublicSupabaseClient()).catch(() => [] as Concert[]),
  ['public-concerts'],
  { revalidate: TTL, tags: ['concerts'] },
))

/** All public artists, cache-keyed to the `artists` tag. */
export const getCachedPublicArtists = cache(unstable_cache(
  async (): Promise<Artist[]> =>
    getPublicArtists(createPublicSupabaseClient()).catch(() => [] as Artist[]),
  ['public-artists'],
  { revalidate: TTL, tags: ['artists'] },
))

/** Site-wide settings, cache-keyed to the `site-settings` tag. */
export const getCachedSiteSettings = cache(unstable_cache(
  async (): Promise<SiteSettings | null> =>
    getSiteSettings(createPublicSupabaseClient()).catch(() => null),
  ['public-site-settings'],
  { revalidate: TTL, tags: ['site-settings'] },
))
