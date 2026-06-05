import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { SubmissionFormField } from '@/types'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['submission_form_schema']['Row']
type Insert = Database['public']['Tables']['submission_form_schema']['Insert']

function rowToField(row: Row): SubmissionFormField {
  return {
    id: row.id,
    formType: row.form_type,
    fieldKey: row.field_key,
    fieldLabelEn: row.field_label_en,
    fieldLabelDe: row.field_label_de,
    fieldType: row.field_type,
    fieldOptions: row.field_options as Record<string, unknown> | null,
    isRequired: row.is_required,
    isVisible: row.is_visible,
    displayOrder: row.display_order,
    placeholderEn: row.placeholder_en,
    placeholderDe: row.placeholder_de,
  }
}

/** Returns only visible fields ordered by display_order (artist-facing). */
export async function getFormSchema(
  db: DbClient,
  formType: 'release' | 'video',
): Promise<SubmissionFormField[]> {
  const { data, error } = await db
    .from('submission_form_schema')
    .select('*')
    .eq('form_type', formType)
    .eq('is_visible', true)
    .order('display_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToField)
}

/** Returns ALL fields including hidden ones (admin use). */
export async function getAllFormSchemaFields(
  db: DbClient,
  formType: 'release' | 'video',
): Promise<SubmissionFormField[]> {
  const { data, error } = await db
    .from('submission_form_schema')
    .select('*')
    .eq('form_type', formType)
    .order('display_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToField)
}

export async function upsertFormField(
  db: DbClient,
  field: Omit<Insert, 'id'> & { id?: string },
): Promise<SubmissionFormField> {
  const { data, error } = await db
    .from('submission_form_schema')
    .upsert(field, { onConflict: 'form_type,field_key' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from upsertFormField')
  return rowToField(data)
}

export async function deleteFormField(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('submission_form_schema').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
