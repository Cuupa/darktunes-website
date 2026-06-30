import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { SubmissionFormField } from '@/types'
import type { SubmissionFieldScope, SubmissionFieldType, VisibilityCondition } from '@/lib/submissions/fieldTypes'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['submission_form_schema']['Row']
type Insert = Database['public']['Tables']['submission_form_schema']['Insert']

function labelsFromRow(row: Row): Record<string, string> {
  return { en: row.field_label_en, de: row.field_label_de }
}

function placeholdersFromRow(row: Row): Record<string, string> | null {
  if (row.placeholder_en == null && row.placeholder_de == null) return null
  return {
    en: row.placeholder_en ?? '',
    de: row.placeholder_de ?? '',
  }
}

function rowToField(row: Row): SubmissionFormField {
  return {
    id: row.id,
    formType: row.form_type,
    fieldKey: row.field_key,
    fieldLabels: labelsFromRow(row),
    fieldType: row.field_type as SubmissionFieldType,
    fieldScope: row.field_scope as SubmissionFieldScope,
    fieldGroup: row.field_group,
    fieldOptions: row.field_options as Record<string, unknown> | null,
    visibilityCondition: row.visibility_condition as VisibilityCondition | null,
    validation: row.validation as Record<string, unknown> | null,
    isRequired: row.is_required,
    isVisible: row.is_visible,
    displayOrder: row.display_order,
    placeholders: placeholdersFromRow(row),
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

export function fieldToApiPayload(
  field: Partial<SubmissionFormField>,
  formType: 'release' | 'video',
): Omit<Insert, 'id'> & { id?: string } {
  const labels = field.fieldLabels ?? { en: '', de: '' }
  const placeholders = field.placeholders
  return {
    id: field.id,
    form_type: formType,
    field_key: field.fieldKey!,
    field_label_en: labels.en ?? labels.de ?? field.fieldKey!,
    field_label_de: labels.de ?? labels.en ?? field.fieldKey!,
    field_type: field.fieldType!,
    field_scope: field.fieldScope ?? 'release',
    field_group: field.fieldGroup ?? null,
    field_options: field.fieldOptions ?? null,
    visibility_condition: (field.visibilityCondition ?? null) as Record<string, unknown> | null,
    validation: field.validation ?? null,
    is_required: field.isRequired ?? false,
    is_visible: field.isVisible ?? true,
    display_order: field.displayOrder ?? 0,
    placeholder_en: placeholders?.en ?? null,
    placeholder_de: placeholders?.de ?? null,
  }
}