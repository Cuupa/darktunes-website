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

// ---------------------------------------------------------------------------
// Domain type
// ---------------------------------------------------------------------------

export interface PromoTrack {
  id: string
  title: string
  artistName: string
  /** Private R2 object key — never expose directly to the browser */
  r2Key: string
  fileSizeBytes: number | undefined
  durationSeconds: number | undefined
  displayOrder: number
  createdAt: string
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToPromoTrack(row: PromoTrackRow): PromoTrack {
  return {
    id: row.id,
    title: row.title,
    artistName: row.artist_name,
    r2Key: row.r2_key,
    fileSizeBytes: row.file_size_bytes ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    displayOrder: row.display_order,
    createdAt: row.created_at,
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetches all promo tracks ordered by display_order ascending. */
export async function getPromoTracks(db: DbClient): Promise<PromoTrack[]> {
  const { data, error } = await db
    .from('promo_tracks')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToPromoTrack(row as PromoTrackRow))
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

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
