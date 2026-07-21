/**
 * Shared on-demand revalidation for public content after sync / CMS writes.
 *
 * Public pages read through `unstable_cache` (tags + up to 1h TTL). Calling
 * revalidateTag alone can leave full-route ISR serving stale HTML until the
 * next segment revalidation; revalidatePath forces the key list pages to
 * rebuild on the next request.
 */

import { revalidatePath, revalidateTag } from 'next/cache'

export const PUBLIC_CONTENT_TAGS = [
  'artists',
  'releases',
  'news',
  'videos',
  'concerts',
  'site-settings',
] as const

export type PublicContentTag = (typeof PUBLIC_CONTENT_TAGS)[number]

const PATHS_BY_TAG: Partial<Record<PublicContentTag, readonly string[]>> = {
  releases: ['/', '/releases'],
  artists: ['/', '/artists'],
  videos: ['/', '/videos'],
  concerts: ['/', '/events'],
  news: ['/', '/news'],
  'site-settings': ['/'],
}

/** Tags commonly invalidated after artist release / concert sync jobs. */
export const RELEASE_SYNC_TAGS: PublicContentTag[] = ['releases', 'artists', 'concerts']

/** Tags invalidated after YouTube channel video sync. */
export const VIDEO_SYNC_TAGS: PublicContentTag[] = ['videos']

/**
 * Bust Data Cache tags and the main public list routes that display them.
 */
export function revalidatePublicContent(tags: readonly PublicContentTag[]): void {
  const paths = new Set<string>()

  for (const tag of tags) {
    revalidateTag(tag, 'max')
    for (const path of PATHS_BY_TAG[tag] ?? []) {
      paths.add(path)
    }
  }

  for (const path of paths) {
    revalidatePath(path)
  }
}
