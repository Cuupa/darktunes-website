/**
 * Shared-inbox ops: claim/assignee, internal notes, audit events, export.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import type { MessageEvent, MessageInternalNote, PortalMessage } from '@/types'

type DbClient = SupabaseClient<Database>

export type MessageSource = 'label' | 'portal'
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent'

function rowToNote(
  row: Database['public']['Tables']['message_internal_notes']['Row'],
): MessageInternalNote {
  return {
    id: row.id,
    messageSource: row.message_source as MessageSource,
    messageId: row.message_id,
    authorUserId: row.author_user_id,
    body: row.body,
    createdAt: row.created_at,
  }
}

function rowToEvent(
  row: Database['public']['Tables']['message_events']['Row'],
): MessageEvent {
  return {
    id: row.id,
    messageSource: row.message_source as MessageSource,
    messageId: row.message_id,
    actorUserId: row.actor_user_id,
    eventType: row.event_type,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  }
}

export async function logMessageEvent(
  db: DbClient,
  opts: {
    source: MessageSource
    messageId: string
    actorUserId?: string | null
    eventType: string
    payload?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await db.from('message_events').insert({
    message_source: opts.source,
    message_id: opts.messageId,
    actor_user_id: opts.actorUserId ?? null,
    event_type: opts.eventType,
    payload: (opts.payload ?? {}) as Json,
  })
  if (error) throw new Error(error.message)
}

export async function claimPortalMessage(
  db: DbClient,
  messageId: string,
  userId: string,
): Promise<PortalMessage> {
  const { data, error } = await db
    .from('portal_messages')
    .update({ assignee_user_id: userId })
    .eq('id', messageId)
    .eq('to_label', true)
    .select()
    .single()
  if (error) throw new Error(error.message)

  await logMessageEvent(db, {
    source: 'portal',
    messageId,
    actorUserId: userId,
    eventType: 'claim',
    payload: { assigneeUserId: userId },
  })

  return mapPortal(data)
}

export async function unclaimPortalMessage(
  db: DbClient,
  messageId: string,
  actorUserId: string,
): Promise<PortalMessage> {
  const { data, error } = await db
    .from('portal_messages')
    .update({ assignee_user_id: null })
    .eq('id', messageId)
    .eq('to_label', true)
    .select()
    .single()
  if (error) throw new Error(error.message)

  await logMessageEvent(db, {
    source: 'portal',
    messageId,
    actorUserId,
    eventType: 'unclaim',
  })

  return mapPortal(data)
}

export async function updatePortalMessageOps(
  db: DbClient,
  messageId: string,
  actorUserId: string,
  patch: { priority?: MessagePriority; tags?: string[] },
): Promise<PortalMessage> {
  const updates: {
    priority?: string
    tags?: string[]
  } = {}
  if (patch.priority) updates.priority = patch.priority
  if (patch.tags) updates.tags = patch.tags

  const { data, error } = await db
    .from('portal_messages')
    .update(updates)
    .eq('id', messageId)
    .eq('to_label', true)
    .select()
    .single()
  if (error) throw new Error(error.message)

  await logMessageEvent(db, {
    source: 'portal',
    messageId,
    actorUserId,
    eventType: 'update_ops',
    payload: patch as Record<string, unknown>,
  })

  return mapPortal(data)
}

export async function listInternalNotes(
  db: DbClient,
  source: MessageSource,
  messageId: string,
): Promise<MessageInternalNote[]> {
  const { data, error } = await db
    .from('message_internal_notes')
    .select('*')
    .eq('message_source', source)
    .eq('message_id', messageId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToNote)
}

export async function addInternalNote(
  db: DbClient,
  opts: {
    source: MessageSource
    messageId: string
    authorUserId: string
    body: string
  },
): Promise<MessageInternalNote> {
  const body = opts.body.trim()
  if (!body) throw new Error('Note body is required')

  const { data, error } = await db
    .from('message_internal_notes')
    .insert({
      message_source: opts.source,
      message_id: opts.messageId,
      author_user_id: opts.authorUserId,
      body,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)

  await logMessageEvent(db, {
    source: opts.source,
    messageId: opts.messageId,
    actorUserId: opts.authorUserId,
    eventType: 'internal_note',
    payload: { noteId: data.id },
  })

  return rowToNote(data)
}

export async function listMessageEvents(
  db: DbClient,
  source: MessageSource,
  messageId: string,
  limit = 50,
): Promise<MessageEvent[]> {
  const { data, error } = await db
    .from('message_events')
    .select('*')
    .eq('message_source', source)
    .eq('message_id', messageId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToEvent)
}

export async function exportPortalMessageBundle(
  db: DbClient,
  messageId: string,
  actorUserId: string,
): Promise<{
  message: PortalMessage
  notes: MessageInternalNote[]
  events: MessageEvent[]
  exportedAt: string
}> {
  const { data, error } = await db
    .from('portal_messages')
    .select('*')
    .eq('id', messageId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Message not found')

  const notes = await listInternalNotes(db, 'portal', messageId)
  const events = await listMessageEvents(db, 'portal', messageId, 100)

  await logMessageEvent(db, {
    source: 'portal',
    messageId,
    actorUserId,
    eventType: 'export',
  })

  return {
    message: mapPortal(data),
    notes,
    events,
    exportedAt: new Date().toISOString(),
  }
}

function mapPortal(
  row: Database['public']['Tables']['portal_messages']['Row'],
): PortalMessage {
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
    senderUserId: row.sender_user_id,
    clientMessageId: row.client_message_id,
    assigneeUserId: row.assignee_user_id,
    priority: row.priority,
    tags: row.tags ?? [],
  }
}
