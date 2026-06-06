/**
 * src/lib/api/portalMessages.ts
 *
 * Data Access Layer for artist-to-artist / artist-to-label messaging
 * (portal_messages, portal_message_folders, portal_message_attachments).
 *
 * Works with both browser (RLS-enforced) and server (service-role) Supabase clients.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { PortalMessage, PortalMessageFolder, PortalMessageAttachment } from '@/types'

type DbClient = SupabaseClient<Database>
type MsgRow = Database['public']['Tables']['portal_messages']['Row']
type FolderRow = Database['public']['Tables']['portal_message_folders']['Row']
type AttachRow = Database['public']['Tables']['portal_message_attachments']['Row']

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToMessage(row: MsgRow): PortalMessage {
  return {
    id: row.id,
    fromArtistId: row.from_artist_id,
    toArtistId: row.to_artist_id,
    toLabel: row.to_label,
    subject: row.subject,
    body: row.body,
    bodyHtml: row.body_html,
    sentAt: row.sent_at,
    readAt: row.read_at,
    starred: row.starred,
    deletedAt: row.deleted_at,
    folderId: row.folder_id,
    hasAttachments: row.has_attachments,
  }
}

function rowToFolder(row: FolderRow): PortalMessageFolder {
  return {
    id: row.id,
    artistId: row.artist_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    position: row.position,
    createdAt: row.created_at,
  }
}

function rowToAttachment(row: AttachRow): PortalMessageAttachment {
  return {
    id: row.id,
    messageId: row.message_id,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  }
}

// ---------------------------------------------------------------------------
// Message queries
// ---------------------------------------------------------------------------

/** Messages received by an artist (to_artist_id = artistId, not deleted). */
export async function getInboxMessages(
  db: DbClient,
  artistId: string,
  folderId?: string | null,
): Promise<PortalMessage[]> {
  let query = db
    .from('portal_messages')
    .select('*')
    .eq('to_artist_id', artistId)
    .is('deleted_at', null)

  if (folderId !== undefined) {
    if (folderId === null) {
      query = query.is('folder_id', null)
    } else {
      query = query.eq('folder_id', folderId)
    }
  }

  const { data, error } = await query.order('sent_at', { ascending: false }).limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToMessage)
}

/** Messages sent by an artist (from_artist_id = artistId, not deleted). */
export async function getSentMessages(
  db: DbClient,
  artistId: string,
): Promise<PortalMessage[]> {
  const { data, error } = await db
    .from('portal_messages')
    .select('*')
    .eq('from_artist_id', artistId)
    .is('deleted_at', null)
    .order('sent_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToMessage)
}

/** Starred messages for an artist (sent or received, not deleted). */
export async function getStarredMessages(
  db: DbClient,
  artistId: string,
): Promise<PortalMessage[]> {
  const { data, error } = await db
    .from('portal_messages')
    .select('*')
    .or(`from_artist_id.eq.${artistId},to_artist_id.eq.${artistId}`)
    .eq('starred', true)
    .is('deleted_at', null)
    .order('sent_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToMessage)
}

/** Soft-deleted messages for an artist (trash view). */
export async function getTrashedMessages(
  db: DbClient,
  artistId: string,
): Promise<PortalMessage[]> {
  const { data, error } = await db
    .from('portal_messages')
    .select('*')
    .or(`from_artist_id.eq.${artistId},to_artist_id.eq.${artistId}`)
    .not('deleted_at', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToMessage)
}

/** Messages sent to the label (to_label = true) by an artist. */
export async function getLabelMessages(
  db: DbClient,
  artistId: string,
): Promise<PortalMessage[]> {
  const { data, error } = await db
    .from('portal_messages')
    .select('*')
    .eq('from_artist_id', artistId)
    .eq('to_label', true)
    .is('deleted_at', null)
    .order('sent_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToMessage)
}

/** Full text / keyword search across portal messages for an artist. */
export async function searchPortalMessages(
  db: DbClient,
  artistId: string,
  query: string,
): Promise<PortalMessage[]> {
  const { data, error } = await db
    .from('portal_messages')
    .select('*')
    .or(`from_artist_id.eq.${artistId},to_artist_id.eq.${artistId}`)
    .textSearch('search_vector', query.trim(), { type: 'websearch' })
    .is('deleted_at', null)
    .order('sent_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToMessage)
}

/** Unread count for an artist's inbox. */
export async function getUnreadCount(db: DbClient, artistId: string): Promise<number> {
  const { count, error } = await db
    .from('portal_messages')
    .select('id', { count: 'exact', head: true })
    .eq('to_artist_id', artistId)
    .is('read_at', null)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
  return count ?? 0
}

// ---------------------------------------------------------------------------
// Message mutations
// ---------------------------------------------------------------------------

export interface SendMessageOpts {
  fromArtistId: string
  toArtistId?: string | null
  toLabel?: boolean
  subject: string
  body: string
  bodyHtml?: string | null
}

/** Sends a new portal message. Returns the created message. */
export async function sendPortalMessage(
  db: DbClient,
  opts: SendMessageOpts,
): Promise<PortalMessage> {
  const { data, error } = await db
    .from('portal_messages')
    .insert({
      from_artist_id: opts.fromArtistId,
      to_artist_id: opts.toArtistId ?? null,
      to_label: opts.toLabel ?? false,
      subject: opts.subject,
      body: opts.body,
      body_html: opts.bodyHtml ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return rowToMessage(data)
}

/** Marks a received message as read. */
export async function markPortalMessageRead(db: DbClient, messageId: string): Promise<void> {
  const { error } = await db
    .from('portal_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId)
    .is('read_at', null)

  if (error) throw new Error(error.message)
}

/** Toggles the starred flag on a message. */
export async function togglePortalMessageStar(
  db: DbClient,
  messageId: string,
  starred: boolean,
): Promise<void> {
  const { error } = await db
    .from('portal_messages')
    .update({ starred })
    .eq('id', messageId)

  if (error) throw new Error(error.message)
}

/** Soft-deletes a message (moves it to trash). */
export async function softDeletePortalMessage(db: DbClient, messageId: string): Promise<void> {
  const { error } = await db
    .from('portal_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)

  if (error) throw new Error(error.message)
}

/** Restores a soft-deleted message. */
export async function restorePortalMessage(db: DbClient, messageId: string): Promise<void> {
  const { error } = await db
    .from('portal_messages')
    .update({ deleted_at: null })
    .eq('id', messageId)

  if (error) throw new Error(error.message)
}

/** Moves a message to a folder (null = Inbox). */
export async function movePortalMessage(
  db: DbClient,
  messageId: string,
  folderId: string | null,
): Promise<void> {
  const { error } = await db
    .from('portal_messages')
    .update({ folder_id: folderId })
    .eq('id', messageId)

  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Folder operations
// ---------------------------------------------------------------------------

export async function getPortalFolders(
  db: DbClient,
  artistId: string,
): Promise<PortalMessageFolder[]> {
  const { data, error } = await db
    .from('portal_message_folders')
    .select('*')
    .eq('artist_id', artistId)
    .order('position', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToFolder)
}

export async function createPortalFolder(
  db: DbClient,
  artistId: string,
  name: string,
  color?: string,
  icon?: string,
): Promise<PortalMessageFolder> {
  const { data: existing } = await db
    .from('portal_message_folders')
    .select('position')
    .eq('artist_id', artistId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (existing?.position ?? -1) + 1

  const { data, error } = await db
    .from('portal_message_folders')
    .insert({ artist_id: artistId, name, color: color ?? null, icon: icon ?? null, position })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return rowToFolder(data)
}

export async function updatePortalFolder(
  db: DbClient,
  folderId: string,
  updates: { name?: string; color?: string | null; icon?: string | null },
): Promise<void> {
  const { error } = await db
    .from('portal_message_folders')
    .update(updates)
    .eq('id', folderId)

  if (error) throw new Error(error.message)
}

export async function deletePortalFolder(db: DbClient, folderId: string): Promise<void> {
  // Move messages in this folder back to inbox first
  await db
    .from('portal_messages')
    .update({ folder_id: null })
    .eq('folder_id', folderId)

  const { error } = await db.from('portal_message_folders').delete().eq('id', folderId)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Attachment queries
// ---------------------------------------------------------------------------

export async function getPortalAttachments(
  db: DbClient,
  messageId: string,
): Promise<PortalMessageAttachment[]> {
  const { data, error } = await db
    .from('portal_message_attachments')
    .select('*')
    .eq('message_id', messageId)

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToAttachment)
}
