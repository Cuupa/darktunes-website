/**
 * src/lib/api/releaseChecklists.ts
 *
 * DAL for the `release_checklists` table.
 * Tracks artist-managed task completion per release.
 * RLS ensures artists can only access their own checklist rows.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type ChecklistRow = Database['public']['Tables']['release_checklists']['Row']

export interface ReleaseChecklist {
  id: string
  artistId: string
  releaseId: string
  task: string
  isCompleted: boolean
  createdAt: string
  updatedAt: string
}

/** Predefined standard release tasks. */
export const DEFAULT_RELEASE_TASKS = [
  'Export final 24-bit WAV master',
  'Upload Cover Artwork (3000×3000px)',
  'Deliver to distributor',
  'Pitch to Spotify editorial (7+ days before release)',
  'Upload to Bandcamp',
  'Prepare social media assets',
  'Write press release',
  'Schedule release announcement',
  'Add smart link (Odesli)',
  'Archive all stems & project files',
] as const

function rowToChecklist(row: ChecklistRow): ReleaseChecklist {
  return {
    id: row.id,
    artistId: row.artist_id,
    releaseId: row.release_id,
    task: row.task,
    isCompleted: row.is_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Returns all checklist items for a given artist+release.
 * If none exist yet, seeds them with DEFAULT_RELEASE_TASKS and returns the result.
 */
export async function getOrCreateReleaseChecklist(
  db: DbClient,
  artistId: string,
  releaseId: string,
): Promise<ReleaseChecklist[]> {
  const { data: existing, error: fetchError } = await db
    .from('release_checklists')
    .select('*')
    .eq('artist_id', artistId)
    .eq('release_id', releaseId)
    .order('created_at', { ascending: true })

  if (fetchError) throw new Error(fetchError.message)

  if (existing && existing.length > 0) {
    return existing.map(rowToChecklist)
  }

  // Seed default tasks
  const inserts = DEFAULT_RELEASE_TASKS.map((task) => ({
    artist_id: artistId,
    release_id: releaseId,
    task,
  }))

  const { data: created, error: insertError } = await db
    .from('release_checklists')
    .insert(inserts)
    .select()

  if (insertError) throw new Error(insertError.message)
  return (created ?? []).map(rowToChecklist)
}

/**
 * Toggles the is_completed state of a single checklist item.
 */
export async function toggleChecklistItem(
  db: DbClient,
  checklistId: string,
  isCompleted: boolean,
): Promise<ReleaseChecklist> {
  const { data, error } = await db
    .from('release_checklists')
    .update({ is_completed: isCompleted })
    .eq('id', checklistId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from toggleChecklistItem')
  return rowToChecklist(data as ChecklistRow)
}
