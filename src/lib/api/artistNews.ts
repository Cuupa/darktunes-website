import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { toSlug } from '@/lib/slugify'
import { stripEmojis, stripEmojisFromHtml } from '@/lib/stripEmojis'
import { PUBLIC_QUERY_LIMITS } from './queryLimits'
import type { ArtistNewsPost } from '@/lib/fan-page/mergeNews'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['artist_news_posts']['Row']
type Insert = Database['public']['Tables']['artist_news_posts']['Insert']
type Update = Database['public']['Tables']['artist_news_posts']['Update']

export const ARTIST_NEWS_TITLE_MAX = 200
export const ARTIST_NEWS_CONTENT_MAX = 20_000
export const ARTIST_NEWS_RATE_MAX = 20
export const ARTIST_NEWS_RATE_WINDOW_MS = 10 * 60_000

export function rowToArtistNewsPost(row: Row): ArtistNewsPost {
  return {
    id: row.id,
    artistId: row.artist_id,
    title: stripEmojis(row.title),
    slug: row.slug,
    excerpt: row.excerpt ? stripEmojis(row.excerpt) : '',
    content: stripEmojisFromHtml(row.content),
    imageUrl: row.image_url ?? undefined,
    status: row.status,
    publishedAt: row.published_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function excerptFromContent(html: string): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length <= 160) return text
  return `${text.slice(0, 157).trimEnd()}…`
}

export function uniqueArtistNewsSlug(title: string, existing: string[]): string {
  const base = toSlug(title).slice(0, 60) || 'post'
  if (!existing.includes(base)) return base
  let n = 2
  while (existing.includes(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

export function toArtistNewsJson(post: ArtistNewsPost) {
  return {
    id: post.id,
    artist_id: post.artistId,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    image_url: post.imageUrl ?? null,
    status: post.status,
    published_at: post.publishedAt ?? null,
    created_at: post.createdAt,
    updated_at: post.updatedAt,
  }
}

export async function listArtistNewsByArtistId(
  db: DbClient,
  artistId: string,
): Promise<ArtistNewsPost[]> {
  const { data, error } = await db
    .from('artist_news_posts')
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false })
    .limit(PUBLIC_QUERY_LIMITS.newsByArtist)
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToArtistNewsPost)
}

export async function getPublishedArtistNewsByArtistId(
  db: DbClient,
  artistId: string,
): Promise<ArtistNewsPost[]> {
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('artist_news_posts')
    .select('*')
    .eq('artist_id', artistId)
    .eq('status', 'published')
    .lte('published_at', now)
    .order('published_at', { ascending: false })
    .limit(PUBLIC_QUERY_LIMITS.newsByArtist)
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToArtistNewsPost)
}

export async function getArtistNewsById(
  db: DbClient,
  id: string,
): Promise<ArtistNewsPost | null> {
  const { data, error } = await db
    .from('artist_news_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? rowToArtistNewsPost(data) : null
}

export async function listArtistNewsSlugs(
  db: DbClient,
  artistId: string,
): Promise<string[]> {
  const { data, error } = await db
    .from('artist_news_posts')
    .select('slug')
    .eq('artist_id', artistId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.slug)
}

export async function createArtistNewsPost(
  db: DbClient,
  payload: Insert,
): Promise<ArtistNewsPost> {
  const { data, error } = await db
    .from('artist_news_posts')
    .insert(payload)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createArtistNewsPost')
  return rowToArtistNewsPost(data)
}

export async function updateArtistNewsPost(
  db: DbClient,
  id: string,
  patch: Update,
): Promise<ArtistNewsPost> {
  const { data, error } = await db
    .from('artist_news_posts')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from updateArtistNewsPost')
  return rowToArtistNewsPost(data)
}

export async function deleteArtistNewsPost(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('artist_news_posts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
