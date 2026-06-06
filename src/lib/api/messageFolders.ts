/**
 * src/lib/api/messageFolders.ts
 *
 * CRUD helpers for the message_folders table.
 * These are virtual "labels" an admin can create to organise messages.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { MessageFolder } from '@/types'

type DbClient = SupabaseClient<Database>
type FolderRow = Database['public']['Tables']['message_folders']['Row']

function rowToFolder(row: FolderRow): MessageFolder {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? undefined,
    color: row.color ?? undefined,
    createdAt: row.created_at,
  }
}

export async function getFolders(db: DbClient): Promise<MessageFolder[]> {
  const { data, error } = await db
    .from('message_folders')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToFolder)
}

export async function createFolder(
  db: DbClient,
  name: string,
  icon?: string,
  color?: string,
): Promise<MessageFolder> {
  const { data, error } = await db
    .from('message_folders')
    .insert({ name, icon: icon ?? null, color: color ?? null })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return rowToFolder(data)
}

export async function updateFolder(
  db: DbClient,
  id: string,
  patch: { name?: string; icon?: string; color?: string },
): Promise<MessageFolder> {
  const { data, error } = await db
    .from('message_folders')
    .update({ name: patch.name, icon: patch.icon ?? null, color: patch.color ?? null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return rowToFolder(data)
}

export async function deleteFolder(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('message_folders').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function moveMessageToFolder(
  db: DbClient,
  messageId: string,
  folderId: string | null,
): Promise<void> {
  const { error } = await db
    .from('label_messages')
    .update({ folder_id: folderId })
    .eq('id', messageId)
  if (error) throw new Error(error.message)
}
