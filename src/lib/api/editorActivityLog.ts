import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { EditorActivityLogEntry } from '@/types'

type DbClient = SupabaseClient<Database>
type EditorActivityLogRow = Database['public']['Tables']['editor_activity_log']['Row']
export type EditorActivityLogInsert = Database['public']['Tables']['editor_activity_log']['Insert']

function rowToEditorActivityLogEntry(row: EditorActivityLogRow): EditorActivityLogEntry {
  return {
    id: row.id,
    editorId: row.editor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityName: row.entity_name ?? undefined,
    changes: row.changes ?? undefined,
    createdAt: row.created_at,
  }
}

export async function createEditorActivityLogEntry(
  db: DbClient,
  entry: EditorActivityLogInsert,
): Promise<EditorActivityLogEntry> {
  const { data, error } = await db
    .from('editor_activity_log')
    .insert(entry)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createEditorActivityLogEntry')
  return rowToEditorActivityLogEntry(data)
}

export async function getEditorActivityLogByEditorId(
  db: DbClient,
  editorId: string,
): Promise<EditorActivityLogEntry[]> {
  const { data, error } = await db
    .from('editor_activity_log')
    .select('*')
    .eq('editor_id', editorId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToEditorActivityLogEntry)
}
