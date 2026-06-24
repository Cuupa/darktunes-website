/**
 * src/lib/api/distributorImportBatches.ts — Bronze import batch metadata.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['distributor_import_batches']['Row']
type BatchStatus = Row['status']

export interface DistributorImportBatch {
  id: string
  periodStart: string
  periodEnd: string
  distributor: string
  r2Key: string
  fileHash: string | undefined
  rowCount: number
  status: BatchStatus
  rulesPresetId: string | undefined
  uploadedBy: string | undefined
  createdAt: string
}

export interface CreateImportBatchData {
  periodStart: string
  periodEnd: string
  distributor: string
  r2Key: string
  fileHash?: string | null
  rowCount?: number
  status?: BatchStatus
  rulesPresetId?: string | null
  uploadedBy?: string | null
}

function rowToBatch(row: Row): DistributorImportBatch {
  return {
    id: row.id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    distributor: row.distributor,
    r2Key: row.r2_key,
    fileHash: row.file_hash ?? undefined,
    rowCount: row.row_count,
    status: row.status,
    rulesPresetId: row.rules_preset_id ?? undefined,
    uploadedBy: row.uploaded_by ?? undefined,
    createdAt: row.created_at,
  }
}

export async function createImportBatch(
  db: DbClient,
  data: CreateImportBatchData,
): Promise<DistributorImportBatch> {
  const { data: row, error } = await db
    .from('distributor_import_batches')
    .insert({
      period_start: data.periodStart,
      period_end: data.periodEnd,
      distributor: data.distributor,
      r2_key: data.r2Key,
      file_hash: data.fileHash ?? null,
      row_count: data.rowCount ?? 0,
      status: data.status ?? 'uploaded',
      rules_preset_id: data.rulesPresetId ?? null,
      uploaded_by: data.uploadedBy ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from createImportBatch')
  return rowToBatch(row as Row)
}

export async function getImportBatchById(
  db: DbClient,
  id: string,
): Promise<DistributorImportBatch | null> {
  const { data, error } = await db
    .from('distributor_import_batches')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }

  return data ? rowToBatch(data as Row) : null
}

export async function listImportBatches(
  db: DbClient,
  limit = 50,
): Promise<DistributorImportBatch[]> {
  const { data, error } = await db
    .from('distributor_import_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToBatch(row as Row))
}

export async function updateImportBatchStatus(
  db: DbClient,
  id: string,
  status: BatchStatus,
  rowCount?: number,
): Promise<void> {
  const { error } = await db
    .from('distributor_import_batches')
    .update({
      status,
      ...(rowCount != null ? { row_count: rowCount } : {}),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/** Remove a batch that never completed upload confirmation (no file_hash). */
export async function deleteUnconfirmedImportBatch(db: DbClient, id: string): Promise<boolean> {
  const { data, error } = await db
    .from('distributor_import_batches')
    .delete()
    .eq('id', id)
    .is('file_hash', null)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data != null
}