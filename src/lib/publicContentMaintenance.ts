import { revalidateTag } from 'next/cache'
import { cache } from 'react'
import { publishScheduledNewsPosts } from '@/lib/api/news'
import { persistEmojiCleanup } from '@/lib/emojiCleanup'
import { enforceHeroFeaturedLimits } from '@/lib/heroFeaturedEnforcement'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'

/**
 * Runs scheduled publish, hero featured enforcement, and emoji cleanup once per request.
 */
export const runPublicContentMaintenance = cache(async (): Promise<void> => {
  try {
    const serviceDb = await createServiceRoleSupabaseClient()
    const publishedCount = await publishScheduledNewsPosts(serviceDb)
    const featuredChanged = await enforceHeroFeaturedLimits(serviceDb)
    const emojiChanged = await persistEmojiCleanup(serviceDb)

    if (publishedCount > 0 || featuredChanged > 0 || emojiChanged > 0) {
      revalidateTag('news', 'max')
    }
    if (featuredChanged > 0) {
      revalidateTag('releases', 'max')
    }
    if (emojiChanged > 0) {
      revalidateTag('releases', 'max')
      revalidateTag('artists', 'max')
      revalidateTag('site-settings', 'max')
    }
  } catch (err) {
    console.error('[runPublicContentMaintenance] Failed:', err)
  }
})