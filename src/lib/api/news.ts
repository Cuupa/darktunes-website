import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { NewsPost } from '@/types'

type DbClient = SupabaseClient<Database>
type NewsRow = Database['public']['Tables']['news_posts']['Row']
export type NewsInsert = Database['public']['Tables']['news_posts']['Insert']
export type NewsUpdate = Database['public']['Tables']['news_posts']['Update']

function rowToNewsPost(row: NewsRow): NewsPost {
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
    isPressOnly: row.is_press_only,
    status,
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
 * Public-facing: only returns posts with status='published' AND published_at ≤ now.
 * Scheduled posts (published_at in the future) are withheld until their publish time.
 */
export async function getPublicNewsPosts(db: DbClient): Promise<NewsPost[]> {
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('news_posts')
    .select('*')
    .eq('status', 'published')
    .lte('published_at', now)
    .order('published_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToNewsPost)
}

export async function getPressOnlyNewsPosts(db: DbClient): Promise<NewsPost[]> {
  const { data, error } = await db
    .from('news_posts')
    .select('*')
    .eq('is_press_only', true)
    .order('published_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToNewsPost)
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
