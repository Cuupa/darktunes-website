import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Release, ReleaseSubmission, SubmissionStatus } from '@/types'
import { createRelease, rowToRelease } from '@/lib/api/releases'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['release_submissions']['Row']
type Insert = Database['public']['Tables']['release_submissions']['Insert']

function rowToSubmission(row: Row): ReleaseSubmission {
  return {
    id: row.id,
    artistId: row.artist_id,
    status: row.status,
    title: row.title,
    releaseDate: row.release_date,
    type: row.type,
    genre: row.genre,
    catalogNumber: row.catalog_number,
    isrc: row.isrc,
    labelCopy: row.label_copy,
    audioDownloadUrl: row.audio_download_url,
    coverArtUrl: row.cover_art_url,
    coverArtVerified: row.cover_art_verified,
    spotifyUrl: row.spotify_url,
    appleMusicUrl: row.apple_music_url,
    youtubeUrl: row.youtube_url,
    notes: row.notes,
    formData: row.form_data as Record<string, unknown> | null,
    adminReply: row.admin_reply,
    adminReplyAt: row.admin_reply_at,
    releaseId: row.release_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getReleaseSubmissionsByArtistId(
  db: DbClient,
  artistId: string,
): Promise<ReleaseSubmission[]> {
  const { data, error } = await db
    .from('release_submissions')
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToSubmission)
}

export async function getAllReleaseSubmissions(db: DbClient): Promise<ReleaseSubmission[]> {
  const { data, error } = await db
    .from('release_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToSubmission)
}

export async function createReleaseSubmission(
  db: DbClient,
  payload: Insert,
): Promise<ReleaseSubmission> {
  const { data, error } = await db
    .from('release_submissions')
    .insert(payload)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createReleaseSubmission')
  return rowToSubmission(data)
}

export async function updateReleaseSubmissionStatus(
  db: DbClient,
  id: string,
  status: SubmissionStatus,
  adminReply?: string,
): Promise<ReleaseSubmission> {
  const patch: Partial<Row> = {
    status,
    ...(adminReply !== undefined
      ? { admin_reply: adminReply, admin_reply_at: new Date().toISOString() }
      : {}),
  }
  const { data, error } = await db
    .from('release_submissions')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from updateReleaseSubmissionStatus')
  return rowToSubmission(data)
}

export async function getReleaseSubmissionById(
  db: DbClient,
  id: string,
): Promise<ReleaseSubmission | null> {
  const { data, error } = await db
    .from('release_submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? rowToSubmission(data) : null
}

/**
 * Creates a hidden catalog release from a submission and links them.
 * Idempotent: if submission already has release_id, returns that release.
 */
export async function createDraftReleaseFromSubmission(
  db: DbClient,
  submissionId: string,
): Promise<{ submission: ReleaseSubmission; release: Release; created: boolean }> {
  const submission = await getReleaseSubmissionById(db, submissionId)
  if (!submission) throw new Error('Submission not found')

  if (submission.releaseId) {
    const { data: existing, error } = await db
      .from('releases')
      .select('*')
      .eq('id', submission.releaseId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (existing) {
      return {
        submission,
        release: rowToRelease(existing),
        created: false,
      }
    }
  }

  const releaseType =
    submission.type === 'compilation' || !submission.type
      ? 'album'
      : submission.type

  const releaseDate =
    submission.releaseDate && /^\d{4}-\d{2}-\d{2}/.test(submission.releaseDate)
      ? submission.releaseDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10)

  const release = await createRelease(db, {
    title: submission.title,
    artist_id: submission.artistId,
    release_date: releaseDate,
    type: releaseType,
    cover_art: submission.coverArtUrl || null,
    catalog_number: submission.catalogNumber,
    isrc: submission.isrc,
    spotify_url: submission.spotifyUrl,
    apple_music_url: submission.appleMusicUrl,
    youtube_url: submission.youtubeUrl,
    is_visible: false,
    featured: false,
    is_promo: false,
    promo_text: submission.labelCopy,
    sync_policy: 'manual_until_street',
  })

  const { error: junctionErr } = await db.from('release_artists' as const).insert({
    release_id: release.id,
    artist_id: submission.artistId,
    sort_order: 0,
  })
  if (
    junctionErr &&
    junctionErr.code !== '23505' &&
    !junctionErr.message.toLowerCase().includes('duplicate')
  ) {
    console.warn('[createDraftReleaseFromSubmission] release_artists:', junctionErr.message)
  }

  const { data: linked, error: linkErr } = await db
    .from('release_submissions')
    .update({ release_id: release.id })
    .eq('id', submissionId)
    .select()
    .single()
  if (linkErr) throw new Error(linkErr.message)
  if (!linked) throw new Error('Failed to link submission to release')

  return {
    submission: rowToSubmission(linked),
    release,
    created: true,
  }
}
