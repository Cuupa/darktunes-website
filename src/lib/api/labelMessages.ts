import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { LabelMessage } from '@/types'

type DbClient = SupabaseClient<Database>
type MessageRow = Database['public']['Tables']['label_messages']['Row']
type MessageInsert = Database['public']['Tables']['label_messages']['Insert']

function rowToMessage(row: MessageRow): LabelMessage {
  return {
    id: row.id,
    artistId: row.artist_id,
    subject: row.subject,
    body: row.body,
    read: row.read,
    sentAt: row.sent_at,
  }
}

export async function getLabelMessages(db: DbClient, artistId: string): Promise<LabelMessage[]> {
  const { data, error } = await db
    .from('label_messages')
    .select('*')
    .eq('artist_id', artistId)
    .order('sent_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToMessage)
}

export async function sendMessage(
  db: DbClient,
  artistId: string,
  subject: string,
  body: string,
): Promise<LabelMessage> {
  const payload: MessageInsert = { artist_id: artistId, subject, body }
  const { data, error } = await db.from('label_messages').insert(payload).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from sendMessage')
  return rowToMessage(data)
}

export async function markMessageRead(db: DbClient, id: string): Promise<LabelMessage> {
  const { data, error } = await db
    .from('label_messages')
    .update({ read: true })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from markMessageRead')
  return rowToMessage(data)
}
