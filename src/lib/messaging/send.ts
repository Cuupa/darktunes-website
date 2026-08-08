/**
 * Messaging domain send service — preferred entry point for new product code.
 * Wraps DAL with actor metadata, client idempotency, and multi-recipient fan-out.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { LabelMessage, PortalMessage } from '@/types'
import { sendMessage } from '@/lib/api/labelMessages'
import { sendPortalMessage, type SendMessageOpts } from '@/lib/api/portalMessages'

type DbClient = SupabaseClient<Database>

export type SendLabelMessageInput = {
  artistId: string
  subject: string
  body: string
  bodyHtml?: string
  senderUserId?: string | null
  /** UUID — retries with the same id return the existing row when present. */
  clientMessageId?: string | null
}

export type SendPortalMessageInput = SendMessageOpts & {
  senderUserId?: string | null
  clientMessageId?: string | null
}

export async function sendLabelMessage(
  db: DbClient,
  input: SendLabelMessageInput,
): Promise<{ message: LabelMessage; duplicate: boolean }> {
  if (input.clientMessageId) {
    const { data: existing } = await db
      .from('label_messages')
      .select('*')
      .eq('client_message_id', input.clientMessageId)
      .maybeSingle()
    if (existing) {
      return {
        message: {
          id: existing.id,
          artistId: existing.artist_id,
          subject: existing.subject,
          body: existing.body,
          bodyHtml: existing.body_html,
          read: existing.read,
          readAt: existing.read_at,
          starred: existing.starred,
          deletedAt: existing.deleted_at,
          sentAt: existing.sent_at,
          folderId: existing.folder_id,
          senderEmail: existing.sender_email,
          isExternal: existing.is_external,
          forwardedFrom: existing.forwarded_from,
          hasAttachments: existing.has_attachments,
          senderUserId: existing.sender_user_id,
          clientMessageId: existing.client_message_id,
        },
        duplicate: true,
      }
    }
  }

  const message = await sendMessage(
    db,
    input.artistId,
    input.subject,
    input.body,
    input.bodyHtml,
    {
      senderUserId: input.senderUserId,
      clientMessageId: input.clientMessageId,
    },
  )
  return { message, duplicate: false }
}

/** Fan-out label message to many artists (admin compose). */
export async function sendLabelMessagesToArtists(
  db: DbClient,
  input: {
    artistIds: string[]
    subject: string
    body: string
    bodyHtml?: string
    senderUserId?: string | null
    /**
     * When a single recipient and a UUID is provided, used as client_message_id.
     * Multi-recipient sends generate independent rows (no shared client id).
     */
    clientMessageId?: string | null
  },
): Promise<LabelMessage[]> {
  const results: LabelMessage[] = []
  const single =
    input.artistIds.length === 1 && input.clientMessageId ? input.clientMessageId : null

  for (const artistId of input.artistIds) {
    const { message } = await sendLabelMessage(db, {
      artistId,
      subject: input.subject,
      body: input.body,
      bodyHtml: input.bodyHtml,
      senderUserId: input.senderUserId,
      clientMessageId: single,
    })
    results.push(message)
  }
  return results
}

export async function sendPortalDomainMessage(
  db: DbClient,
  input: SendPortalMessageInput,
): Promise<{ message: PortalMessage; duplicate: boolean }> {
  if (input.clientMessageId) {
    const { data: existing } = await db
      .from('portal_messages')
      .select('*')
      .eq('client_message_id', input.clientMessageId)
      .maybeSingle()
    if (existing) {
      return {
        message: {
          id: existing.id,
          fromArtistId: existing.from_artist_id,
          toArtistId: existing.to_artist_id,
          toLabel: existing.to_label,
          subject: existing.subject,
          body: existing.body,
          bodyHtml: existing.body_html,
          sentAt: existing.sent_at,
          readAt: existing.read_at,
          starred: existing.starred,
          deletedAt: existing.deleted_at,
          folderId: existing.folder_id,
          hasAttachments: existing.has_attachments,
          senderUserId: existing.sender_user_id,
          clientMessageId: existing.client_message_id,
        },
        duplicate: true,
      }
    }
  }

  const message = await sendPortalMessage(db, {
    fromArtistId: input.fromArtistId,
    toArtistId: input.toArtistId,
    toLabel: input.toLabel,
    subject: input.subject,
    body: input.body,
    bodyHtml: input.bodyHtml,
    senderUserId: input.senderUserId,
    clientMessageId: input.clientMessageId,
  })
  return { message, duplicate: false }
}
