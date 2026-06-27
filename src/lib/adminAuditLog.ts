/**
 * src/lib/adminAuditLog.ts
 *
 * Append-only audit trail for admin actions (admin_audit_log table).
 * Server-only.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>

export interface LogAdminActionOptions {
  actorId: string
  action: string
  resource: string
  resourceId?: string | null
  details?: Record<string, unknown>
  ipAddress?: string | null
}

export async function logAdminAction(
  db: DbClient,
  opts: LogAdminActionOptions,
): Promise<void> {
  try {
    await db.from('admin_audit_log').insert({
      actor_id: opts.actorId,
      action: opts.action,
      resource: opts.resource,
      resource_id: opts.resourceId ?? null,
      details: opts.details ?? {},
      ip_address: opts.ipAddress ?? null,
    })
  } catch {
    // Audit failures must not break the primary operation
  }
}