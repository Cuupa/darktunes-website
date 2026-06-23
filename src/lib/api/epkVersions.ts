/**
 * src/lib/api/epkVersions.ts
 *
 * DAL for EPK document version history.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'

type DbClient = SupabaseClient<Database>
type EpkVersionRow = Database['public']['Tables']['epk_versions']['Row']

export interface EpkVersion {
  id: string
  artistId: string
  document: EpkDocumentV2
  versionNumber: number
  label: string | undefined
  createdBy: string | undefined
  createdAt: string
}

function rowToEpkVersion(row: EpkVersionRow): EpkVersion {
  return {
    id: row.id,
    artistId: row.artist_id,
    document: row.document as unknown as EpkDocumentV2,
    versionNumber: row.version_number,
    label: row.label ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  }
}

export async function createEpkVersion(
  db: DbClient,
  data: {
    artistId: string
    document: EpkDocumentV2
    versionNumber: number
    createdBy: string
    label?: string
  },
): Promise<EpkVersion> {
  const { data: row, error } = await db
    .from('epk_versions')
    .insert({
      artist_id: data.artistId,
      document: data.document as unknown as Record<string, unknown>,
      version_number: data.versionNumber,
      created_by: data.createdBy,
      label: data.label ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return rowToEpkVersion(row)
}

export async function listEpkVersions(
  db: DbClient,
  artistId: string,
  limit = 20,
): Promise<EpkVersion[]> {
  const { data, error } = await db
    .from('epk_versions')
    .select('*')
    .eq('artist_id', artistId)
    .order('version_number', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToEpkVersion)
}

export async function getEpkVersionById(
  db: DbClient,
  artistId: string,
  versionId: string,
): Promise<EpkVersion | null> {
  const { data, error } = await db
    .from('epk_versions')
    .select('*')
    .eq('id', versionId)
    .eq('artist_id', artistId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return rowToEpkVersion(data)
}