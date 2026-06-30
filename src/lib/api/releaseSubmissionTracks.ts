import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { ReleaseSubmissionTrack } from '@/types'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['release_submission_tracks']['Row']
type Insert = Database['public']['Tables']['release_submission_tracks']['Insert']

function rowToTrack(row: Row): ReleaseSubmissionTrack {
  return {
    id: row.id,
    submissionId: row.submission_id,
    trackNumber: row.track_number,
    title: row.title,
    isrc: row.isrc,
    composer: row.composer,
    author: row.author,
    genre: row.genre,
    language: row.language,
    gema: row.gema,
    explicit: row.explicit,
    live: row.live,
    cover: row.cover,
    instrumental: row.instrumental,
    previewStartSeconds: row.preview_start_seconds,
    durationSeconds: row.duration_seconds,
    formData: row.form_data as Record<string, unknown> | null,
    displayOrder: row.display_order,
    createdAt: row.created_at,
  }
}

export async function getTracksBySubmissionId(
  db: DbClient,
  submissionId: string,
): Promise<ReleaseSubmissionTrack[]> {
  const { data, error } = await db
    .from('release_submission_tracks')
    .select('*')
    .eq('submission_id', submissionId)
    .order('display_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToTrack)
}

export async function getTracksBySubmissionIds(
  db: DbClient,
  submissionIds: string[],
): Promise<ReleaseSubmissionTrack[]> {
  if (submissionIds.length === 0) return []
  const { data, error } = await db
    .from('release_submission_tracks')
    .select('*')
    .in('submission_id', submissionIds)
    .order('display_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToTrack)
}

export async function createReleaseSubmissionTracks(
  db: DbClient,
  tracks: Insert[],
): Promise<ReleaseSubmissionTrack[]> {
  if (tracks.length === 0) return []
  const { data, error } = await db.from('release_submission_tracks').insert(tracks).select()
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToTrack)
}