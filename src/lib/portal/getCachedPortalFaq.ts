import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { createPublicSupabaseClient } from '@/lib/supabase/publicClient'
import { getPublishedPortalFaq } from '@/lib/api/portalFaq'
import type { PortalFaqTree } from '@/types'

const TTL = 60

export const getCachedPortalFaq = cache(
  unstable_cache(
    async (): Promise<PortalFaqTree[]> =>
      getPublishedPortalFaq(createPublicSupabaseClient()).catch(() => [] as PortalFaqTree[]),
    ['portal-faq-published'],
    { revalidate: TTL, tags: ['portal-faq'] },
  ),
)