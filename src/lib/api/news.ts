import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { NewsPost } from '@/types'

type DbClient = SupabaseClient<Database>
type NewsRow = Database['public']['Tables']['news_posts']['Row']
export type NewsInsert = Database['public']['Tables']['news_posts']['Insert']
export type NewsUpdate = Database['public']['Tables']['news_posts']['Update']

function rowToNewsPost(row: NewsRow): NewsPost {
  const r = row as NewsRow & {
    embargo_until?: string | null
    media_contact?: string | null
    release_category?: string | null
    reviewed_by?: string | null
  }
  const validStatuses = ['draft', 'published', 'scheduled', 'archived'] as const
  type NewsStatus = typeof validStatuses[number]
  const status: NewsStatus = (validStatuses as readonly string[]).includes(row.status)
    ? (row.status as NewsStatus)
    : 'published'
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? '',
    content: row.content,
    imageUrl: row.image_url ?? undefined,
    publishedAt: row.published_at,
    featured: row.featured,
    isPressOnly: row.is_press_only,
    artistId: row.artist_id ?? null,
    status,
    embargoUntil: r.embargo_until ?? undefined,
    mediaContact: r.media_contact ?? undefined,
    releaseCategory: r.release_category ?? undefined,
    heroPrimaryBtn: (row.hero_primary_btn_action || row.hero_primary_btn_label || row.hero_primary_btn_href)
      ? {
          label: row.hero_primary_btn_label ?? undefined,
          action: (row.hero_primary_btn_action as 'link' | 'scroll' | 'none') ?? undefined,
          href: row.hero_primary_btn_href ?? undefined,
        }
      : undefined,
    heroSecondaryBtn: (row.hero_secondary_btn_action || row.hero_secondary_btn_label || row.hero_secondary_btn_href)
      ? {
          label: row.hero_secondary_btn_label ?? undefined,
          action: (row.hero_secondary_btn_action as 'link' | 'scroll' | 'none') ?? undefined,
          href: row.hero_secondary_btn_href ?? undefined,
        }
      : undefined,
    reviewedBy: r.reviewed_by ?? undefined,
  }
}

export async function getNewsPosts(db: DbClient): Promise<NewsPost[]> {
  const { data, error } = await db
    .from('news_posts')
    .select('*')
    .order('published_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToNewsPost)
}

/**
 * Public-facing: returns published posts and scheduled posts once their publish time is reached.
 */
export async function getPublicNewsPosts(db: DbClient): Promise<NewsPost[]> {
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('news_posts')
    .select('*')
    .in('status', ['published', 'scheduled'])
    .lte('published_at', now)
    .order('published_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToNewsPost)
}

/**
 * Public-facing: returns published posts associated with a specific artist.
 */
export async function getPublicNewsPostsByArtistId(db: DbClient, artistId: string): Promise<NewsPost[]> {
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('news_posts')
    .select('*')
    .eq('artist_id', artistId)
    .in('status', ['published', 'scheduled'])
    .lte('published_at', now)
    .order('published_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToNewsPost)
}

export async function getPressOnlyNewsPosts(db: DbClient): Promise<NewsPost[]> {
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('news_posts')
    .select('*')
    .eq('is_press_only', true)
    .or(`embargo_until.is.null,embargo_until.lte.${now}`)
    .order('published_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToNewsPost)
}

export async function getPressReleaseBySlug(db: DbClient, slug: string): Promise<NewsPost | null> {
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('news_posts')
    .select('*')
    .eq('slug', slug)
    .eq('is_press_only', true)
    .or(`embargo_until.is.null,embargo_until.lte.${now}`)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data ? rowToNewsPost(data) : null
}

export async function getNewsPostBySlug(db: DbClient, slug: string): Promise<NewsPost | null> {
  const { data, error } = await db.from('news_posts').select('*').eq('slug', slug).single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data ? rowToNewsPost(data) : null
}

export async function getNewsPostById(db: DbClient, id: string): Promise<NewsPost | null> {
  const { data, error } = await db.from('news_posts').select('*').eq('id', id).single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data ? rowToNewsPost(data) : null
}

export async function createNewsPost(db: DbClient, newsData: NewsInsert): Promise<NewsPost> {
  const { data, error } = await db.from('news_posts').insert(newsData).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createNewsPost')
  return rowToNewsPost(data)
}

export async function updateNewsPost(
  db: DbClient,
  id: string,
  newsData: NewsUpdate,
): Promise<NewsPost> {
  const { data, error } = await db
    .from('news_posts')
    .update(newsData)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from updateNewsPost')
  return rowToNewsPost(data)
}

export async function deleteNewsPost(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('news_posts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
