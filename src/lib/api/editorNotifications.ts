/**
 * Staff dashboard notification DAL.
 * Backed by the unified `notifications` table (Phase 1 platform).
 * Function names retained for call-site compatibility.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { DashboardNotification } from '@/types'
import {
  getUserNotifications,
  getUserUnreadNotificationCount,
  markAllUserNotificationsRead,
  markNotificationRead,
} from '@/lib/api/notifications'

type DbClient = SupabaseClient<Database>

export async function getEditorNotifications(
  db: DbClient,
  userId: string,
  limit = 20,
): Promise<DashboardNotification[]> {
  return getUserNotifications(db, userId, { limit })
}

export async function getEditorUnreadCount(db: DbClient, userId: string): Promise<number> {
  return getUserUnreadNotificationCount(db, userId)
}

export async function markEditorNotificationRead(db: DbClient, id: string): Promise<void> {
  return markNotificationRead(db, id)
}

export async function markAllEditorNotificationsRead(db: DbClient, userId: string): Promise<void> {
  return markAllUserNotificationsRead(db, userId)
}
