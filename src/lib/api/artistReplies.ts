import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { ArtistReply } from '@/types'

type DbClient = SupabaseClient<Database>
type ArtistReplyRow = Database['public']['Tables']['artist_replies']['Row']

function rowToArtistReply(row: ArtistReplyRow): ArtistReply {
  return {
    id: row.id,
    messageId: row.message_id,
    artistId: row.artist_id,
    body: row.body,
    bodyHtml: row.body_html,
    deletedAt: row.deleted_at,
    sentAt: row.sent_at,
  }
}

export async function getRepliesForMessage(db: DbClient, messageId: string): Promise<ArtistReply[]> {
  const { data, error } = await db
    .from('artist_replies')
    .select('*')
    .eq('message_id', messageId)
    .is('deleted_at', null)
    .order('sent_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToArtistReply)
}

export async function sendArtistReply(
  db: DbClient,
  messageId: string,
  artistId: string,
  body: string,
  bodyHtml?: string,
): Promise<ArtistReply> {
  const { data, error } = await db
    .from('artist_replies')
    .insert({ message_id: messageId, artist_id: artistId, body, body_html: bodyHtml ?? null })
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from sendArtistReply')
  return rowToArtistReply(data)
}

export async function editReply(db: DbClient, id: string, body: string, bodyHtml?: string): Promise<ArtistReply> {
  const { data, error } = await db
    .from('artist_replies')
    .update({ body, body_html: bodyHtml ?? null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from editReply')
  return rowToArtistReply(data)
}

export async function softDeleteReply(db: DbClient, id: string): Promise<void> {
  const { error } = await db
    .from('artist_replies')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
