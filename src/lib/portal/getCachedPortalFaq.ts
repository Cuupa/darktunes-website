import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { createPublicSupabaseClient } from '@/lib/supabase/publicClient'
import { getPublishedPortalFaq } from '@/lib/api/portalFaq'
import { logError } from '@/lib/observability/logger'
import type { PortalFaqTree } from '@/types'

const TTL = 60

// The cache callback must reject on error so Next keeps the last good value;
// the empty fallback lives outside unstable_cache and is never cached.
const readPublishedPortalFaq = unstable_cache(
  async (): Promise<PortalFaqTree[]> => getPublishedPortalFaq(createPublicSupabaseClient()),
  ['portal-faq-published'],
  { revalidate: TTL, tags: ['portal-faq'] },
)

export const getCachedPortalFaq: () => Promise<PortalFaqTree[]> = cache(
  async (): Promise<PortalFaqTree[]> => {
    try {
      return await readPublishedPortalFaq()
    } catch (error) {
      logError('public_cache.read_failed', error, { key: 'portal-faq-published' })
      return []
    }
  },
)
