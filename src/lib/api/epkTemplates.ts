/**
 * src/lib/api/epkTemplates.ts
 *
 * DAL for admin EPK brand guideline / starter templates (epk_templates table).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { safeParseEpkDocumentV2 } from '@/lib/epk/schema/documentV2'

type DbClient = SupabaseClient<Database>
type TemplateRow = Database['public']['Tables']['epk_templates']['Row']

export interface EpkTemplate {
  id: string
  name: string
  description: string | undefined
  document: EpkDocumentV2
  isPublished: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface UpsertEpkTemplateInput {
  name: string
  description?: string
  document: EpkDocumentV2
  isPublished?: boolean
  sortOrder?: number
}

function rowToTemplate(row: TemplateRow): EpkTemplate | null {
  const parsed = safeParseEpkDocumentV2(row.document)
  if (!parsed.success) return null

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    document: parsed.data,
    isPublished: row.is_published,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listPublishedEpkTemplates(db: DbClient): Promise<EpkTemplate[]> {
  const { data, error } = await db
    .from('epk_templates')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((row) => rowToTemplate(row as TemplateRow))
    .filter((row): row is EpkTemplate => row !== null)
}

export async function listAllEpkTemplates(db: DbClient): Promise<EpkTemplate[]> {
  const { data, error } = await db
    .from('epk_templates')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((row) => rowToTemplate(row as TemplateRow))
    .filter((row): row is EpkTemplate => row !== null)
}

export async function createEpkTemplate(
  db: DbClient,
  input: UpsertEpkTemplateInput,
): Promise<EpkTemplate> {
  const { data, error } = await db
    .from('epk_templates')
    .insert({
      name: input.name,
      description: input.description ?? null,
      document: input.document as unknown as Json,
      is_published: input.isPublished ?? false,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createEpkTemplate')
  const template = rowToTemplate(data as TemplateRow)
  if (!template) throw new Error('Invalid template document returned from createEpkTemplate')
  return template
}

export async function updateEpkTemplate(
  db: DbClient,
  id: string,
  input: Partial<UpsertEpkTemplateInput>,
): Promise<EpkTemplate> {
  const patch: Database['public']['Tables']['epk_templates']['Update'] = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.description !== undefined) patch.description = input.description ?? null
  if (input.document !== undefined) patch.document = input.document as unknown as Json
  if (input.isPublished !== undefined) patch.is_published = input.isPublished
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder

  const { data, error } = await db
    .from('epk_templates')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from updateEpkTemplate')
  const template = rowToTemplate(data as TemplateRow)
  if (!template) throw new Error('Invalid template document returned from updateEpkTemplate')
  return template
}

export async function deleteEpkTemplate(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('epk_templates').delete().eq('id', id)
  if (error) throw new Error(error.message)
}