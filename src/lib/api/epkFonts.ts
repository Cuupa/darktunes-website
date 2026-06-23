/**
 * src/lib/api/epkFonts.ts
 *
 * DAL for custom EPK canvas fonts (epk_fonts table).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type EpkFontRow = Database['public']['Tables']['epk_fonts']['Row']
type EpkFontInsert = Database['public']['Tables']['epk_fonts']['Insert']

export interface EpkFontRecord {
  id: string
  artistId: string | undefined
  name: string
  r2Key: string
  mimeType: string
  createdAt: string
}

export function buildEpkFontPublicUrl(r2Key: string, r2PublicUrl: string): string {
  return `${r2PublicUrl.replace(/\/$/, '')}/${r2Key}`
}

function rowToEpkFontRecord(row: EpkFontRow): EpkFontRecord {
  return {
    id: row.id,
    artistId: row.artist_id ?? undefined,
    name: row.name,
    r2Key: row.r2_key,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  }
}

export async function listEpkFonts(db: DbClient, artistId: string): Promise<EpkFontRecord[]> {
  const { data, error } = await db
    .from('epk_fonts')
    .select('*')
    .or(`artist_id.eq.${artistId},artist_id.is.null`)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToEpkFontRecord)
}

export async function getEpkFontById(
  db: DbClient,
  id: string,
  artistId: string,
): Promise<EpkFontRecord | null> {
  const { data, error } = await db
    .from('epk_fonts')
    .select('*')
    .eq('id', id)
    .or(`artist_id.eq.${artistId},artist_id.is.null`)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return rowToEpkFontRecord(data)
}

export async function createEpkFont(db: DbClient, data: EpkFontInsert): Promise<EpkFontRecord> {
  const { data: row, error } = await db.from('epk_fonts').insert(data).select().single()
  if (error) throw new Error(error.message)
  return rowToEpkFontRecord(row)
}

export async function deleteEpkFont(db: DbClient, id: string, artistId: string): Promise<EpkFontRecord | null> {
  const existing = await getEpkFontById(db, id, artistId)
  if (!existing || (existing.artistId && existing.artistId !== artistId)) return null

  const { error } = await db.from('epk_fonts').delete().eq('id', id)
  if (error) throw new Error(error.message)
  return existing
}