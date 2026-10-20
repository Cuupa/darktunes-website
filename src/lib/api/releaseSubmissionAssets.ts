import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { ReleaseSubmissionAssetKind } from '@/lib/submissions/submissionAssets'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['release_submission_assets']['Row']

export interface ReleaseSubmissionAsset {
  id: string
  artistId: string
  submissionId: string | null
  kind: ReleaseSubmissionAssetKind
  r2Key: string
  contentType: string | null
  byteSize: number | null
  expiresAt: string
  createdAt: string
}

function rowToAsset(row: Row): ReleaseSubmissionAsset {
  return {
    id: row.id,
    artistId: row.artist_id,
    submissionId: row.submission_id,
    kind: row.kind,
    r2Key: row.r2_key,
    contentType: row.content_type,
    byteSize: row.byte_size,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

export async function createReleaseSubmissionAsset(
  db: DbClient,
  payload: Database['public']['Tables']['release_submission_assets']['Insert'],
): Promise<ReleaseSubmissionAsset> {
  const { data, error } = await db.from('release_submission_assets').insert(payload).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createReleaseSubmissionAsset')
  return rowToAsset(data)
}

export async function getReleaseSubmissionAssetById(
  db: DbClient,
  id: string,
): Promise<ReleaseSubmissionAsset | null> {
  const { data, error } = await db.from('release_submission_assets').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? rowToAsset(data) : null
}

export async function getReleaseSubmissionAssetByKey(
  db: DbClient,
  r2Key: string,
): Promise<ReleaseSubmissionAsset | null> {
  const { data, error } = await db
    .from('release_submission_assets')
    .select('*')
    .eq('r2_key', r2Key)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? rowToAsset(data) : null
}

export async function attachAssetsToSubmission(
  db: DbClient,
  artistId: string,
  submissionId: string,
  keys: string[],
  expiresAt: string,
): Promise<void> {
  if (keys.length === 0) return
  const { error } = await db
    .from('release_submission_assets')
    .update({ submission_id: submissionId, expires_at: expiresAt })
    .eq('artist_id', artistId)
    .in('r2_key', keys)
  if (error) throw new Error(error.message)
}

export async function clearExpiredSubmissionPointer(
  db: DbClient,
  asset: Pick<ReleaseSubmissionAsset, 'kind' | 'r2Key' | 'submissionId'>,
): Promise<void> {
  if (!asset.submissionId) return
  const patch =
    asset.kind === 'audio'
      ? { audio_r2_key: null, audio_download_url: '' }
      : { cover_r2_key: null, cover_art_url: '' }
  const column = asset.kind === 'audio' ? 'audio_r2_key' : 'cover_r2_key'
  const { error } = await db
    .from('release_submissions')
    .update(patch)
    .eq('id', asset.submissionId)
    .eq(column, asset.r2Key)
  if (error) throw new Error(error.message)
}

export async function listExpiredReleaseSubmissionAssets(
  db: DbClient,
  nowIso: string,
): Promise<ReleaseSubmissionAsset[]> {
  const { data, error } = await db
    .from('release_submission_assets')
    .select('*')
    .lte('expires_at', nowIso)
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToAsset)
}

export async function deleteReleaseSubmissionAsset(
  db: DbClient,
  id: string,
): Promise<void> {
  const { error } = await db.from('release_submission_assets').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
