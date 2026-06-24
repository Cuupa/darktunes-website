/**
 * DAL for sos_period_summaries — admin revenue trend snapshots with Bronze lineage.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['sos_period_summaries']['Row']

export interface SosPeriodSummary {
  id: string
  periodStart: string
  periodEnd: string
  totalRevenue: number
  totalPayout: number
  artistCount: number
  artistBreakdowns: unknown[]
  platformBreakdowns: unknown[]
  sourceBatchIds: string[]
  createdAt: string
}

export interface UpsertSosPeriodSummaryInput {
  periodStart: string
  periodEnd: string
  totalRevenue: number
  totalPayout: number
  artistCount: number
  artistBreakdowns: unknown[]
  platformBreakdowns: unknown[]
  sourceBatchIds?: string[]
}

function rowToSummary(row: Row): SosPeriodSummary {
  return {
    id: row.id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalRevenue: Number(row.total_revenue),
    totalPayout: Number(row.total_payout),
    artistCount: row.artist_count,
    artistBreakdowns: row.artist_breakdowns as unknown[],
    platformBreakdowns: row.platform_breakdowns as unknown[],
    sourceBatchIds: row.source_batch_ids ?? [],
    createdAt: row.created_at,
  }
}

export async function upsertSosPeriodSummary(
  db: DbClient,
  input: UpsertSosPeriodSummaryInput,
): Promise<SosPeriodSummary> {
  const { data, error } = await db
    .from('sos_period_summaries')
    .upsert(
      {
        period_start: input.periodStart,
        period_end: input.periodEnd,
        total_revenue: input.totalRevenue,
        total_payout: input.totalPayout,
        artist_count: input.artistCount,
        artist_breakdowns: input.artistBreakdowns,
        platform_breakdowns: input.platformBreakdowns,
        source_batch_ids: input.sourceBatchIds ?? [],
      },
      { onConflict: 'period_start,period_end' },
    )
    .select()
    .single()

  if (error) throw new Error(error.message)
  return rowToSummary(data)
}

export async function listSosPeriodSummaries(db: DbClient): Promise<SosPeriodSummary[]> {
  const { data, error } = await db
    .from('sos_period_summaries')
    .select('*')
    .order('period_start', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToSummary(row as Row))
}