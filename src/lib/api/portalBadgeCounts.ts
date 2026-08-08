import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getLabelUnreadCount } from '@/lib/api/labelMessages'
import { getPortalPeerUnreadCount } from '@/lib/api/portalMessages'
import type { PortalBadgeCounts } from '@/contexts/PortalNotificationProvider'
import { safeCount } from '@/lib/api/safeCount'

type DbClient = SupabaseClient<Database>

export async function getPortalBadgeCounts(
  db: DbClient,
  artistId: string,
  userId?: string | null,
): Promise<PortalBadgeCounts> {
  const [labelUnread, portalUnread, interviews, statements, alerts] = await Promise.all([
    getLabelUnreadCount(db, artistId, userId).catch(() => 0),
    getPortalPeerUnreadCount(db, artistId, userId).catch(() => 0),
    safeCount(
      db
        .from('interview_requests')
        .select('id', { count: 'exact', head: true })
        .eq('artist_id', artistId)
        .eq('status', 'pending'),
    ),
    safeCount(
      db
        .from('sales_statements')
        .select('id', { count: 'exact', head: true })
        .eq('artist_id', artistId)
        .eq('status', 'artist_notified'),
    ),
    // Unified platform notifications for this artist (RLS → current user)
    safeCount(
      db
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('artist_id', artistId)
        .eq('read', false),
    ),
  ])

  return {
    messages: labelUnread + portalUnread,
    interviews,
    statements,
    alerts,
  }
}
