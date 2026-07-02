import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { DashboardNotification } from '@/types'

type DbClient = SupabaseClient<Database>
type NotificationRow = Database['public']['Tables']['editor_notifications']['Row']

function rowToNotification(row: NotificationRow): DashboardNotification {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    type: row.type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityName: row.entity_name ?? undefined,
    senderId: row.sender_id,
    read: row.read,
    createdAt: row.created_at,
  }
}

export async function getEditorNotifications(
  db: DbClient,
  userId: string,
  limit = 20,
): Promise<DashboardNotification[]> {
  const { data, error } = await db
    .from('editor_notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToNotification)
}

export async function getEditorUnreadCount(db: DbClient, userId: string): Promise<number> {
  const { count, error } = await db
    .from('editor_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('read', false)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function markEditorNotificationRead(db: DbClient, id: string): Promise<void> {
  const { error } = await db
    .from('editor_notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('read', false)

  if (error) throw new Error(error.message)
}

export async function markAllEditorNotificationsRead(db: DbClient, userId: string): Promise<void> {
  const { error } = await db
    .from('editor_notifications')
    .update({ read: true })
    .eq('recipient_id', userId)
    .eq('read', false)

  if (error) throw new Error(error.message)
}