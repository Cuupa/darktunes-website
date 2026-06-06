/**
 * src/lib/api/artistDocuments.ts
 *
 * Data Access Layer for the `artist_documents` table.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type DocumentRow = Database['public']['Tables']['artist_documents']['Row']

// ---------------------------------------------------------------------------
// Domain type
// ---------------------------------------------------------------------------

export interface ArtistDocument {
  id: string
  artistId: string
  label: string
  category: string
  filePath: string
  fileSizeBytes: number | undefined
  mimeType: string | undefined
  notes: string | undefined
  createdAt: string
  updatedAt: string
}

function rowToArtistDocument(row: DocumentRow): ArtistDocument {
  return {
    id: row.id,
    artistId: row.artist_id,
    label: row.label,
    category: row.category,
    filePath: row.file_path,
    fileSizeBytes: row.file_size_bytes ?? undefined,
    mimeType: row.mime_type ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listArtistDocuments(
  supabase: DbClient,
  artistId: string,
): Promise<ArtistDocument[]> {
  const { data, error } = await supabase
    .from('artist_documents')
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list documents: ${error.message}`)
  return (data ?? []).map(rowToArtistDocument)
}

export async function getArtistDocument(
  supabase: DbClient,
  id: string,
  artistId: string,
): Promise<ArtistDocument | null> {
  const { data, error } = await supabase
    .from('artist_documents')
    .select('*')
    .eq('id', id)
    .eq('artist_id', artistId)
    .single()

  if (error) return null
  return rowToArtistDocument(data)
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface CreateDocumentData {
  artistId: string
  label: string
  category: string
  filePath: string
  fileSizeBytes?: number
  mimeType?: string
  notes?: string
}

export async function createArtistDocument(
  supabase: DbClient,
  data: CreateDocumentData,
): Promise<ArtistDocument> {
  const { data: row, error } = await supabase
    .from('artist_documents')
    .insert({
      artist_id: data.artistId,
      label: data.label,
      category: data.category,
      file_path: data.filePath,
      file_size_bytes: data.fileSizeBytes ?? null,
      mime_type: data.mimeType ?? null,
      notes: data.notes ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create document: ${error.message}`)
  return rowToArtistDocument(row)
}

export async function deleteArtistDocument(
  supabase: DbClient,
  id: string,
  artistId: string,
): Promise<void> {
  const { error } = await supabase
    .from('artist_documents')
    .delete()
    .eq('id', id)
    .eq('artist_id', artistId)

  if (error) throw new Error(`Failed to delete document: ${error.message}`)
}
