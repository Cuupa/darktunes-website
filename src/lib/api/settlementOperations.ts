/**
 * DAL for settlement_operations — durable journal for financial idempotency.
 * The client-provided operation id is used as the row id so a replay lookup
 * is a primary-key read (no 24h TTL, unlike idempotency_keys).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { toDbRecord } from '@/lib/types/jsonColumns'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['settlement_operations']['Row']

export type SettlementOperationStatus = Row['status']

export interface SettlementOperation {
  id: string
  operationType: string
  resourceType: string
  resourceId: string
  actorId: string | undefined
  payloadHash: string
  status: SettlementOperationStatus
  result: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface InsertSettlementOperationInput {
  id: string
  operationType: string
  resourceType: string
  resourceId: string
  actorId?: string | null
  amountCents?: number | null
  currency?: string | null
  payloadHash: string
}

function rowToOperation(row: Row): SettlementOperation {
  return {
    id: row.id,
    operationType: row.operation_type,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    actorId: row.actor_id ?? undefined,
    payloadHash: row.payload_hash,
    status: row.status,
    result: (row.result ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getSettlementOperationById(
  db: DbClient,
  id: string,
): Promise<SettlementOperation | null> {
  const { data, error } = await db
    .from('settlement_operations')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? rowToOperation(data as Row) : null
}

/**
 * Inserts the operation claim. A concurrent insert with the same id is not an
 * error — the caller re-reads the winning row and decides replay/conflict.
 */
export async function insertSettlementOperation(
  db: DbClient,
  input: InsertSettlementOperationInput,
): Promise<SettlementOperation | null> {
  const { data, error } = await db
    .from('settlement_operations')
    .insert({
      id: input.id,
      operation_type: input.operationType,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      actor_id: input.actorId ?? null,
      amount_cents: input.amountCents ?? null,
      currency: input.currency ?? null,
      payload_hash: input.payloadHash,
      status: 'accepted',
      result: {},
    })
    .select()
    .maybeSingle()

  if (error) {
    if ((error as { code?: string }).code === '23505') return null
    throw new Error(error.message)
  }
  return data ? rowToOperation(data as Row) : null
}

export async function completeSettlementOperation(
  db: DbClient,
  id: string,
  result: Record<string, unknown>,
): Promise<void> {
  const { error } = await db
    .from('settlement_operations')
    .update({ status: 'ready', result: toDbRecord(result) })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function failSettlementOperation(db: DbClient, id: string): Promise<void> {
  const { error } = await db
    .from('settlement_operations')
    .update({ status: 'failed' })
    .eq('id', id)

  if (error) throw new Error(error.message)
}
