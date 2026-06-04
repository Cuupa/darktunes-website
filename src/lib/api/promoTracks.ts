/**
 * src/lib/api/promoTracks.ts
 *
 * Data Access Layer for the `promo_tracks` table.
 *
 * Promo tracks are PRIVATE unreleased audio files stored in Cloudflare R2.
 * SECURITY: Only the R2 object key is stored — NO public URL is ever written
 * to this table. The actual stream URL is generated on-demand as a short-lived
 * presigned GET URL via a journalist-gated Server Action.
 *
 * RLS restricts SELECT to journalist and admin roles.
 * Only admins can insert/delete tracks.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type PromoTrackRow = Database['public']['Tables']['promo_tracks']['Row']
type PromoTrackInsert = Database['public']['Tables']['promo_tracks']['Insert']

export interface PromoTrack {
  id: string
  title: string
  artistName: string
  /** Private R2 object key — never expose directly to the browser */
  r2Key: string
  fileSizeBytes: number | undefined
  durationSeconds: number | undefined
  displayOrder: number
  genre: string | undefined
  bpm: number | undefined
  key: string | undefined
  releaseDate: string | undefined
  ndaRequired: boolean
  embargoUntil: string | undefined
  createdAt: string
}

function rowToPromoTrack(row: PromoTrackRow): PromoTrack {
  const r = row as PromoTrackRow & {
    genre?: string | null
    bpm?: number | null
    key?: string | null
    release_date?: string | null
    nda_required?: boolean
    embargo_until?: string | null
  }
  return {
    id: r.id,
    title: r.title,
    artistName: r.artist_name,
    r2Key: r.r2_key,
    fileSizeBytes: r.file_size_bytes ?? undefined,
    durationSeconds: r.duration_seconds ?? undefined,
    displayOrder: r.display_order,
    genre: r.genre ?? undefined,
    bpm: r.bpm ?? undefined,
    key: r.key ?? undefined,
    releaseDate: r.release_date ?? undefined,
    ndaRequired: r.nda_required ?? false,
    embargoUntil: r.embargo_until ?? undefined,
    createdAt: r.created_at,
  }
}

/** Fetches all promo tracks ordered by display_order ascending. */
export async function getPromoTracks(db: DbClient): Promise<PromoTrack[]> {
  const { data, error } = await db
    .from('promo_tracks')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToPromoTrack(row as PromoTrackRow))
}

/**
 * Inserts a new promo track record.
 * Caller MUST be admin (enforced by RLS).
 * The r2_key is obtained from the presigned PUT upload flow.
 * Do NOT provide a public_url — the R2 bucket is private.
 */
export async function createPromoTrack(
  db: DbClient,
  track: PromoTrackInsert,
): Promise<PromoTrack> {
  const { data, error } = await db.from('promo_tracks').insert(track).select().single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createPromoTrack')
  return rowToPromoTrack(data as PromoTrackRow)
}

/** Deletes a promo track record by ID. Caller MUST be admin (enforced by RLS). */
export async function deletePromoTrack(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('promo_tracks').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
