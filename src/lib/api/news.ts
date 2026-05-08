import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { NewsPost } from '@/types'

type DbClient = SupabaseClient<Database>
type NewsRow = Database['public']['Tables']['news_posts']['Row']
export type NewsInsert = Database['public']['Tables']['news_posts']['Insert']
export type NewsUpdate = Database['public']['Tables']['news_posts']['Update']

function rowToNewsPost(row: NewsRow): NewsPost {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? '',
    content: row.content,
    imageUrl: row.image_url ?? undefined,
    publishedAt: row.published_at,
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
