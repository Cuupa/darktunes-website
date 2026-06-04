/**
 * src/lib/api/pressPhotos.ts
 *
 * Data Access Layer for the `press_photos` table.
 *
 * Press photos are publicly readable EPK assets stored in Cloudflare R2.
 * The public_url is the CDN URL served to everyone; it should be passed through
 * getOptimizedImageUrl() for display but used directly for hi-res downloads.
 *
 * Only admins can insert/delete photos; uploads flow through a presigned PUT URL
 * Server Action to stay below Vercel's 4.5 MB body limit.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type PressPhotoRow = Database['public']['Tables']['press_photos']['Row']
type PressPhotoInsert = Database['public']['Tables']['press_photos']['Insert']

export interface PressPhoto {
  id: string
  title: string
  altText: string | undefined
  r2Key: string
  publicUrl: string
  displayOrder: number
  category: string
  artistId: string | undefined
  createdAt: string
}

function rowToPressPhoto(row: PressPhotoRow): PressPhoto {
  const r = row as PressPhotoRow & { category?: string; artist_id?: string | null }
  return {
    id: r.id,
    title: r.title,
    altText: r.alt_text ?? undefined,
    r2Key: r.r2_key,
    publicUrl: r.public_url,
    displayOrder: r.display_order,
    category: r.category ?? 'photo',
    artistId: r.artist_id ?? undefined,
    createdAt: r.created_at,
  }
}

/** Fetches all press photos ordered by display_order ascending. */
export async function getPressPhotos(db: DbClient): Promise<PressPhoto[]> {
  const { data, error } = await db
    .from('press_photos')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToPressPhoto(row as PressPhotoRow))
}

/**
 * Inserts a new press photo record.
 * Caller MUST be admin (enforced by RLS).
 * The r2_key and public_url are obtained from the presigned PUT upload flow.
 */
export async function createPressPhoto(
  db: DbClient,
  photo: PressPhotoInsert,
): Promise<PressPhoto> {
  const { data, error } = await db.from('press_photos').insert(photo).select().single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createPressPhoto')
  return rowToPressPhoto(data as PressPhotoRow)
}

/** Deletes a press photo record by ID. Caller MUST be admin (enforced by RLS). */
export async function deletePressPhoto(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('press_photos').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
