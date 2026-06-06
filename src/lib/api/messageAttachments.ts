/**
 * src/lib/api/messageAttachments.ts
 *
 * Helpers for message_attachments table.
 * Attachments are uploaded to R2 storage; only their metadata is stored here.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { MessageAttachment } from '@/types'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['message_attachments']['Row']

function rowToAttachment(row: Row): MessageAttachment {
  return {
    id: row.id,
    messageId: row.message_id,
    filename: row.filename,
    url: row.url,
    mimeType: row.mime_type,
    size: row.size,
    createdAt: row.created_at,
  }
}

export async function getAttachmentsForMessage(
  db: DbClient,
  messageId: string,
): Promise<MessageAttachment[]> {
  const { data, error } = await db
    .from('message_attachments')
    .select('*')
    .eq('message_id', messageId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToAttachment)
}

export async function createAttachmentRecord(
  db: DbClient,
  messageId: string,
  filename: string,
  url: string,
  mimeType: string,
  size: number,
): Promise<MessageAttachment> {
  const { data, error } = await db
    .from('message_attachments')
    .insert({ message_id: messageId, filename, url, mime_type: mimeType, size })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return rowToAttachment(data)
}

export async function deleteAttachment(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('message_attachments').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
