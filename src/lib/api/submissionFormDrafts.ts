/**
 * DAL for in-progress portal submission wizards (release / video).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type FormType = 'release' | 'video'
type Row = Database['public']['Tables']['submission_form_drafts']['Row']

export interface SubmissionFormDraft {
  id: string
  artistId: string
  userId: string
  formType: FormType
  payload: Record<string, unknown>
  updatedAt: string
  createdAt: string
}

function rowToDraft(row: Row): SubmissionFormDraft {
  return {
    id: row.id,
    artistId: row.artist_id,
    userId: row.user_id,
    formType: row.form_type,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

export async function getSubmissionFormDraft(
  db: DbClient,
  artistId: string,
  userId: string,
  formType: FormType,
): Promise<SubmissionFormDraft | null> {
  const { data, error } = await db
    .from('submission_form_drafts')
    .select('*')
    .eq('artist_id', artistId)
    .eq('user_id', userId)
    .eq('form_type', formType)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? rowToDraft(data) : null
}

export async function upsertSubmissionFormDraft(
  db: DbClient,
  input: {
    artistId: string
    userId: string
    formType: FormType
    payload: Record<string, unknown>
  },
): Promise<SubmissionFormDraft> {
  const { data, error } = await db
    .from('submission_form_drafts')
    .upsert(
      {
        artist_id: input.artistId,
        user_id: input.userId,
        form_type: input.formType,
        payload: input.payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'artist_id,user_id,form_type' },
    )
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from upsertSubmissionFormDraft')
  return rowToDraft(data)
}

export async function deleteSubmissionFormDraft(
  db: DbClient,
  artistId: string,
  userId: string,
  formType: FormType,
): Promise<void> {
  const { error } = await db
    .from('submission_form_drafts')
    .delete()
    .eq('artist_id', artistId)
    .eq('user_id', userId)
    .eq('form_type', formType)
  if (error) throw new Error(error.message)
}
