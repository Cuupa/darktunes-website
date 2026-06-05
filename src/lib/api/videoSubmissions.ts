import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { VideoSubmission, SubmissionStatus } from '@/types'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['video_submissions']['Row']
type Insert = Database['public']['Tables']['video_submissions']['Insert']

function rowToSubmission(row: Row): VideoSubmission {
  return {
    id: row.id,
    artistId: row.artist_id,
    status: row.status,
    title: row.title,
    description: row.description,
    downloadUrl: row.download_url,
    thumbnailUrl: row.thumbnail_url,
    youtubeTitle: row.youtube_title,
    youtubeDescription: row.youtube_description,
    youtubeTags: row.youtube_tags ?? [],
    youtubeCategory: row.youtube_category,
    targetPublishDate: row.target_publish_date,
    notes: row.notes,
    adminReply: row.admin_reply,
    adminReplyAt: row.admin_reply_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getVideoSubmissionsByArtistId(
  db: DbClient,
  artistId: string,
): Promise<VideoSubmission[]> {
  const { data, error } = await db
    .from('video_submissions')
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToSubmission)
}

export async function getAllVideoSubmissions(db: DbClient): Promise<VideoSubmission[]> {
  const { data, error } = await db
    .from('video_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToSubmission)
}

export async function createVideoSubmission(
  db: DbClient,
  payload: Insert,
): Promise<VideoSubmission> {
  const { data, error } = await db
    .from('video_submissions')
    .insert(payload)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createVideoSubmission')
  return rowToSubmission(data)
}

export async function updateVideoSubmissionStatus(
  db: DbClient,
  id: string,
  status: SubmissionStatus,
  adminReply?: string,
): Promise<VideoSubmission> {
  const patch: Partial<Row> = {
    status,
    ...(adminReply !== undefined
      ? { admin_reply: adminReply, admin_reply_at: new Date().toISOString() }
      : {}),
  }
  const { data, error } = await db
    .from('video_submissions')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from updateVideoSubmissionStatus')
  return rowToSubmission(data)
}
