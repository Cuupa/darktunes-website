import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { markMessageRead } from '@/lib/api/labelMessages'
import { markPortalMessageRead } from '@/lib/api/portalMessages'

type DbClient = SupabaseClient<Database>

export type PortalNotificationKind = 'label_message' | 'portal_message' | 'interview' | 'statement'

export interface PortalNotificationItem {
  id: string
  kind: PortalNotificationKind
  title: string
  href: string
  createdAt: string
  isUnread: boolean
  canMarkRead: boolean
}

function buildPortalHref(path: string, artistId: string): string {
  return `${path}?artistId=${artistId}`
}

export async function getPortalNotificationFeed(
  db: DbClient,
  artistId: string,
  limit = 20,
): Promise<PortalNotificationItem[]> {
  const [labelResult, portalResult, interviewResult, statementResult] = await Promise.all([
    db
      .from('label_messages')
      .select('id, subject, sent_at, read')
      .eq('artist_id', artistId)
      .is('deleted_at', null)
      .order('sent_at', { ascending: false })
      .limit(limit),
    db
      .from('portal_messages')
      .select('id, subject, sent_at, read_at')
      .eq('to_artist_id', artistId)
      .is('deleted_at', null)
      .order('sent_at', { ascending: false })
      .limit(limit),
    db
      .from('interview_requests')
      .select('id, subject, created_at, status')
      .eq('artist_id', artistId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit),
    db
      .from('sales_statements')
      .select('id, period, filename, created_at, status')
      .eq('artist_id', artistId)
      .eq('status', 'artist_notified')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  if (labelResult.error) throw new Error(labelResult.error.message)
  if (portalResult.error) throw new Error(portalResult.error.message)
  if (interviewResult.error) throw new Error(interviewResult.error.message)
  if (statementResult.error) throw new Error(statementResult.error.message)

  const messagesHref = buildPortalHref('/portal/messages', artistId)
  const interviewsHref = buildPortalHref('/portal/interviews', artistId)
  const statementsHref = buildPortalHref('/portal/statements', artistId)

  const items: PortalNotificationItem[] = [
    ...(labelResult.data ?? []).map((row) => ({
      id: row.id,
      kind: 'label_message' as const,
      title: row.subject,
      href: messagesHref,
      createdAt: row.sent_at,
      isUnread: !row.read,
      canMarkRead: true,
    })),
    ...(portalResult.data ?? []).map((row) => ({
      id: row.id,
      kind: 'portal_message' as const,
      title: row.subject,
      href: messagesHref,
      createdAt: row.sent_at,
      isUnread: row.read_at === null,
      canMarkRead: true,
    })),
    ...(interviewResult.data ?? []).map((row) => ({
      id: row.id,
      kind: 'interview' as const,
      title: row.subject,
      href: interviewsHref,
      createdAt: row.created_at,
      isUnread: true,
      canMarkRead: false,
    })),
    ...(statementResult.data ?? []).map((row) => ({
      id: row.id,
      kind: 'statement' as const,
      title: row.period || row.filename,
      href: statementsHref,
      createdAt: row.created_at,
      isUnread: true,
      canMarkRead: false,
    })),
  ]

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

export async function markAllPortalMessagesRead(db: DbClient, artistId: string): Promise<void> {
  const now = new Date().toISOString()

  const [labelResult, portalResult] = await Promise.all([
    db
      .from('label_messages')
      .update({ read: true, read_at: now })
      .eq('artist_id', artistId)
      .eq('read', false)
      .is('deleted_at', null),
    db
      .from('portal_messages')
      .update({ read_at: now })
      .eq('to_artist_id', artistId)
      .is('read_at', null)
      .is('deleted_at', null),
  ])

  if (labelResult.error) throw new Error(labelResult.error.message)
  if (portalResult.error) throw new Error(portalResult.error.message)
}

export async function markPortalNotificationItemRead(
  db: DbClient,
  item: Pick<PortalNotificationItem, 'id' | 'kind'>,
): Promise<void> {
  if (item.kind === 'label_message') {
    await markMessageRead(db, item.id)
    return
  }

  if (item.kind === 'portal_message') {
    await markPortalMessageRead(db, item.id)
  }
}