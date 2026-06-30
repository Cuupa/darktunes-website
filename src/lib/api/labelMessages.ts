import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { LabelMessage, MessageTemplate } from '@/types'

type DbClient = SupabaseClient<Database>
type MessageRow = Database['public']['Tables']['label_messages']['Row']
type MessageInsert = Database['public']['Tables']['label_messages']['Insert']
type TemplateRow = Database['public']['Tables']['message_templates']['Row']
type TemplateInsert = Database['public']['Tables']['message_templates']['Insert']

function rowToMessage(row: MessageRow): LabelMessage {
  return {
    id: row.id,
    artistId: row.artist_id,
    subject: row.subject,
    body: row.body,
    bodyHtml: row.body_html,
    read: row.read,
    readAt: row.read_at,
    starred: row.starred,
    deletedAt: row.deleted_at,
    sentAt: row.sent_at,
  }
}

function rowToTemplate(row: TemplateRow): MessageTemplate {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    bodyHtml: row.body_html,
    createdAt: row.created_at,
  }
}

export async function getLabelUnreadCount(db: DbClient, artistId: string): Promise<number> {
  const { count, error } = await db
    .from('label_messages')
    .select('id', { count: 'exact', head: true })
    .eq('artist_id', artistId)
    .eq('read', false)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function getLabelMessages(db: DbClient, artistId: string): Promise<LabelMessage[]> {
  const { data, error } = await db
    .from('label_messages')
    .select('*')
    .eq('artist_id', artistId)
    .is('deleted_at', null)
    .order('sent_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToMessage)
}

export async function getAllLabelMessages(db: DbClient): Promise<LabelMessage[]> {
  const { data, error } = await db
    .from('label_messages')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToMessage)
}

export async function searchLabelMessages(
  db: DbClient,
  query: string,
  filters?: { artistId?: string; unreadOnly?: boolean },
): Promise<LabelMessage[]> {
  let builder = db.from('label_messages').select('*').is('deleted_at', null)
  if (query.trim()) {
    builder = builder.textSearch('search_vector', query.trim(), { type: 'websearch' })
  }
  if (filters?.artistId) {
    builder = builder.eq('artist_id', filters.artistId)
  }
  if (filters?.unreadOnly) {
    builder = builder.eq('read', false)
  }
  const { data, error } = await builder.order('sent_at', { ascending: false }).limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToMessage)
}

export async function sendMessage(
  db: DbClient,
  artistId: string,
  subject: string,
  body: string,
  bodyHtml?: string,
): Promise<LabelMessage> {
  const payload: MessageInsert = { artist_id: artistId, subject, body, body_html: bodyHtml ?? null }
  const { data, error } = await db.from('label_messages').insert(payload).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from sendMessage')
  return rowToMessage(data)
}

export async function markMessageRead(db: DbClient, id: string): Promise<LabelMessage> {
  const { data, error } = await db
    .from('label_messages')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from markMessageRead')
  return rowToMessage(data)
}

export async function starMessage(db: DbClient, id: string, starred: boolean): Promise<LabelMessage> {
  const { data, error } = await db
    .from('label_messages')
    .update({ starred })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from starMessage')
  return rowToMessage(data)
}

export async function softDeleteMessage(db: DbClient, id: string): Promise<void> {
  const { error } = await db
    .from('label_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function hardDeleteMessages(db: DbClient, ids: string[]): Promise<void> {
  const { error } = await db.from('label_messages').delete().in('id', ids)
  if (error) throw new Error(error.message)
}

export async function getMessageTemplates(db: DbClient): Promise<MessageTemplate[]> {
  const { data, error } = await db.from('message_templates').select('*').order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToTemplate)
}

export async function saveMessageTemplate(
  db: DbClient,
  name: string,
  subject: string,
  bodyHtml: string,
): Promise<MessageTemplate> {
  const payload: TemplateInsert = { name, subject, body_html: bodyHtml }
  const { data, error } = await db.from('message_templates').insert(payload).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from saveMessageTemplate')
  return rowToTemplate(data)
}

export async function deleteMessageTemplate(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('message_templates').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
