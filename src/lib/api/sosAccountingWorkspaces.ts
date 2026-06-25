/**
 * DAL for sos_accounting_workspaces — server-persisted live accounting workspace
 * for a period. Stores rules config + attached bronze batch references.
 * Enables collaborative, anytime retrieval of the full SOS configuration.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  normalizeAccountingConfig,
  type SosAccountingSettings,
} from '@/lib/sos/sosAccountingSettings'
import { toDbRecord } from '@/lib/types/jsonColumns'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['sos_accounting_workspaces']['Row']

export type AccountingWorkspaceConfig = SosAccountingSettings

export interface SosAccountingWorkspace {
  id: string
  periodStart: string
  periodEnd: string
  config: AccountingWorkspaceConfig
  bronzeBatchIds: string[]
  updatedBy: string | undefined
  createdAt: string
  updatedAt: string
}

export interface UpsertAccountingWorkspaceInput {
  periodStart: string
  periodEnd: string
  config: AccountingWorkspaceConfig
  bronzeBatchIds?: string[]
  updatedBy?: string | null
}

function rowToWorkspace(row: Row): SosAccountingWorkspace {
  return {
    id: row.id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    config: normalizeAccountingConfig(row.config as Partial<SosAccountingSettings>),
    bronzeBatchIds: row.bronze_batch_ids ?? [],
    updatedBy: row.updated_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getWorkspaceForPeriod(
  db: DbClient,
  periodStart: string,
  periodEnd: string,
): Promise<SosAccountingWorkspace | null> {
  const { data, error } = await db
    .from('sos_accounting_workspaces')
    .select('*')
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? rowToWorkspace(data as Row) : null
}

export async function upsertWorkspaceForPeriod(
  db: DbClient,
  input: UpsertAccountingWorkspaceInput,
): Promise<SosAccountingWorkspace> {
  const config = normalizeAccountingConfig(input.config)
  const { data, error } = await db
    .from('sos_accounting_workspaces')
    .upsert(
      {
        period_start: input.periodStart,
        period_end: input.periodEnd,
        config: toDbRecord(config),
        bronze_batch_ids: input.bronzeBatchIds ?? [],
        updated_by: input.updatedBy ?? null,
      },
      { onConflict: 'period_start,period_end' },
    )
    .select()
    .single()

  if (error) throw new Error(error.message)
  return rowToWorkspace(data as Row)
}

export async function listAccountingWorkspaces(db: DbClient): Promise<SosAccountingWorkspace[]> {
  const { data, error } = await db
    .from('sos_accounting_workspaces')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToWorkspace(row as Row))
}