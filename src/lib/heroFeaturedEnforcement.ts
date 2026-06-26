import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { computeHeroFeaturedEnforcement } from '@/lib/heroFeatured'
import { rowToNewsPost } from '@/lib/api/news'
import { rowToRelease } from '@/lib/api/releases'

type DbClient = SupabaseClient<Database>

/**
 * Applies automatic hero featured limits in the database.
 * Returns the number of rows updated.
 */
export async function enforceHeroFeaturedLimits(db: DbClient): Promise<number> {
  const now = new Date().toISOString()

  const [{ data: releaseRows, error: releaseError }, { data: newsRows, error: newsError }] =
    await Promise.all([
      db.from('releases').select('*').eq('featured', true),
      db
        .from('news_posts')
        .select('*')
        .eq('featured', true)
        .in('status', ['published', 'scheduled'])
        .lte('published_at', now),
    ])

  if (releaseError) throw new Error(releaseError.message)
  if (newsError) throw new Error(newsError.message)

  const releases = (releaseRows ?? []).map(rowToRelease)
  const news = (newsRows ?? []).map(rowToNewsPost)
  const updates = computeHeroFeaturedEnforcement(releases, news)

  let changed = 0
  for (const update of updates) {
    const table = update.kind === 'release' ? 'releases' : 'news_posts'
    const { error } = await db
      .from(table)
      .update({
        featured: false,
        featured_removed_reason: update.featured_removed_reason,
        updated_at: now,
      })
      .eq('id', update.id)

    if (error) throw new Error(error.message)
    changed++
  }

  return changed
}