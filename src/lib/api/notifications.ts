/**
 * DAL for the unified `notifications` table.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { DashboardNotification } from '@/types'

type DbClient = SupabaseClient<Database>
type NotificationRow = Database['public']['Tables']['notifications']['Row']

function rowToDashboardNotification(row: NotificationRow): DashboardNotification {
  return {
    id: row.id,
    recipientId: row.user_id,
    type: row.type,
    entityType: row.entity_type,
    entityId: row.entity_id ?? '',
    entityName: row.entity_name ?? undefined,
    senderId: row.sender_id,
    read: row.read,
    createdAt: row.created_at,
  }
}

export async function getUserNotifications(
  db: DbClient,
  userId: string,
  opts?: { limit?: number; unreadOnly?: boolean; offset?: number },
): Promise<DashboardNotification[]> {
  const limit = opts?.limit ?? 20
  const offset = opts?.offset ?? 0

  let query = db
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts?.unreadOnly) {
    query = query.eq('read', false)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToDashboardNotification)
}

export async function getUserUnreadNotificationCount(
  db: DbClient,
  userId: string,
): Promise<number> {
  const { count, error } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function markNotificationRead(db: DbClient, id: string): Promise<void> {
  const { error } = await db
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('read', false)

  if (error) throw new Error(error.message)
}

export async function markAllUserNotificationsRead(
  db: DbClient,
  userId: string,
): Promise<void> {
  const { error } = await db
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) throw new Error(error.message)
}

/** Mark staff portal-message notifications for an entity as read. */
export async function markNotificationsReadByEntity(
  db: DbClient,
  opts: { entityId: string; type: string; userId?: string },
): Promise<void> {
  let query = db
    .from('notifications')
    .update({ read: true })
    .eq('entity_id', opts.entityId)
    .eq('type', opts.type)
    .eq('read', false)

  if (opts.userId) {
    query = query.eq('user_id', opts.userId)
  }

  const { error } = await query
  if (error) throw new Error(error.message)
}

export async function getArtistScopedNotifications(
  db: DbClient,
  opts: { userId: string; artistId: string; limit?: number },
): Promise<NotificationRow[]> {
  const { data, error } = await db
    .from('notifications')
    .select('*')
    .eq('user_id', opts.userId)
    .eq('artist_id', opts.artistId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 20)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getArtistScopedUnreadCount(
  db: DbClient,
  opts: { userId: string; artistId: string },
): Promise<number> {
  const { count, error } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', opts.userId)
    .eq('artist_id', opts.artistId)
    .eq('read', false)

  if (error) throw new Error(error.message)
  return count ?? 0
}
