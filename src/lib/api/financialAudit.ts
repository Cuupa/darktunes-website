import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>

export interface FinancialAuditInput {
  entityType: string
  entityId: string
  action: string
  actorId?: string | null
  beforeData?: Record<string, unknown> | null
  afterData?: Record<string, unknown> | null
}

export async function logFinancialEvent(db: DbClient, input: FinancialAuditInput): Promise<void> {
  const { error } = await db.from('financial_audit_events').insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    actor_id: input.actorId ?? null,
    before_data: input.beforeData ?? null,
    after_data: input.afterData ?? null,
  })

  if (error) throw new Error(error.message)
}

export async function listFinancialAuditEvents(
  db: DbClient,
  entityType: string,
  entityId: string,
  limit = 50,
): Promise<Database['public']['Tables']['financial_audit_events']['Row'][]> {
  const { data, error } = await db
    .from('financial_audit_events')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return data ?? []
}