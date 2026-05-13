import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Video } from '@/types'

type DbClient = SupabaseClient<Database>
type VideoRow = Database['public']['Tables']['videos']['Row']
export type VideoInsert = Database['public']['Tables']['videos']['Insert']
export type VideoUpdate = Database['public']['Tables']['videos']['Update']

function rowToVideo(row: VideoRow): Video {
  return {
    id: row.id,
    title: row.title,
    artistName: row.artist_name,
    artistId: row.artist_id ?? undefined,
    youtubeId: row.youtube_id,
    thumbnailUrl: row.thumbnail_url ?? '',
    publishedAt: row.published_at,
    isVisible: row.is_visible,
    isShort: row.is_short,
  }
}

export async function getVideos(db: DbClient): Promise<Video[]> {
  const { data, error } = await db
    .from('videos')
    .select('*')
    .order('published_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToVideo)
}

/** Public-facing: only returns visible videos. */
export async function getPublicVideos(db: DbClient): Promise<Video[]> {
  const { data, error } = await db
    .from('videos')
    .select('*')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToVideo)
}

export async function getVideoById(db: DbClient, id: string): Promise<Video | null> {
  const { data, error } = await db.from('videos').select('*').eq('id', id).single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data ? rowToVideo(data) : null
}

export async function getVideosByArtistId(db: DbClient, artistId: string): Promise<Video[]> {
  const { data, error } = await db
    .from('videos')
    .select('*')
    .eq('artist_id', artistId)
    .order('published_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToVideo)
}

export async function createVideo(db: DbClient, videoData: VideoInsert): Promise<Video> {
  const { data, error } = await db.from('videos').insert(videoData).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createVideo')
  return rowToVideo(data)
}

export async function updateVideo(
  db: DbClient,
  id: string,
  videoData: VideoUpdate,
): Promise<Video> {
  const { data, error } = await db
    .from('videos')
    .update(videoData)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from updateVideo')
  return rowToVideo(data)
}

export async function deleteVideo(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('videos').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
