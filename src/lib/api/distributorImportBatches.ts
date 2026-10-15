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
  operationId: string | undefined
  multipartUploadId: string | undefined
  multipartStartedAt: string | undefined
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
  operationId?: string | null
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
    operationId: row.operation_id ?? undefined,
    multipartUploadId: row.multipart_upload_id ?? undefined,
    multipartStartedAt: row.multipart_started_at ?? undefined,
    rowCount: row.row_count,
    status: row.status,
    rulesPresetId: row.rules_preset_id ?? undefined,
    uploadedBy: row.uploaded_by ?? undefined,
    createdAt: row.created_at,
  }
}

export class DuplicateImportBatchError extends Error {
  constructor() {
    super('An active import batch with this file hash already exists')
    this.name = 'DuplicateImportBatchError'
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
      operation_id: data.operationId ?? null,
      row_count: data.rowCount ?? 0,
      status: data.status ?? 'uploaded',
      rules_preset_id: data.rulesPresetId ?? null,
      uploaded_by: data.uploadedBy ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new DuplicateImportBatchError()
    throw new Error(error.message)
  }
  if (!row) throw new Error('No data returned from createImportBatch')
  return rowToBatch(row as Row)
}

export async function getImportBatchByOperationId(
  db: DbClient,
  operationId: string,
): Promise<DistributorImportBatch | null> {
  const { data, error } = await db
    .from('distributor_import_batches')
    .select('*')
    .eq('operation_id', operationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? rowToBatch(data as Row) : null
}

export async function findImportBatchByFileHash(
  db: DbClient,
  fileHash: string,
): Promise<DistributorImportBatch | null> {
  const normalized = fileHash.toLowerCase()
  const { data, error } = await db
    .from('distributor_import_batches')
    .select('*')
    .eq('file_hash', normalized)
    .neq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? rowToBatch(data as Row) : null
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

/** Load multiple bronze batches by id (e.g. statement provenance). */
export async function getImportBatchesByIds(
  db: DbClient,
  ids: string[],
): Promise<DistributorImportBatch[]> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return []

  const { data, error } = await db
    .from('distributor_import_batches')
    .select('*')
    .in('id', unique)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToBatch(row as Row))
}

/**
 * Artist-safe provenance for a statement-linked bronze batch.
 * Omits R2 keys — downloads go through portal/admin routes only.
 */
export interface StatementSourceProvenance {
  batchId: string
  distributor: string
  periodStart: string
  periodEnd: string
  fileHash: string | undefined
  rowCount: number
  uploadedAt: string
  batchStatus: DistributorImportBatch['status']
  /** True when a SHA-256 hash is stored and the bronze object is downloadable. */
  canDownloadSource: boolean
}

export function toStatementSourceProvenance(
  batch: DistributorImportBatch,
): StatementSourceProvenance {
  return {
    batchId: batch.id,
    distributor: batch.distributor,
    periodStart: batch.periodStart,
    periodEnd: batch.periodEnd,
    fileHash: batch.fileHash,
    rowCount: batch.rowCount,
    uploadedAt: batch.createdAt,
    batchStatus: batch.status,
    canDownloadSource: Boolean(batch.fileHash) && batch.status !== 'failed',
  }
}

/** Map statement id → provenance for statements that have a batch_id. */
export async function getStatementProvenanceByStatementIds(
  db: DbClient,
  statements: Array<{ id: string; batchId?: string }>,
): Promise<Record<string, StatementSourceProvenance>> {
  const batchIds = statements
    .map((s) => s.batchId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  const batches = await getImportBatchesByIds(db, batchIds)
  const byBatchId = new Map(batches.map((b) => [b.id, toStatementSourceProvenance(b)]))

  const out: Record<string, StatementSourceProvenance> = {}
  for (const s of statements) {
    if (!s.batchId) continue
    const prov = byBatchId.get(s.batchId)
    if (prov) out[s.id] = prov
  }
  return out
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

export async function setImportBatchMultipartUpload(
  db: DbClient,
  id: string,
  uploadId: string | null,
  startedAt: string | null = null,
  onlyIfEmpty = false,
): Promise<boolean> {
  let query = db
    .from('distributor_import_batches')
    .update({
      multipart_upload_id: uploadId,
      multipart_started_at: uploadId ? startedAt : null,
    })
    .eq('id', id)
    .neq('status', 'completed')
  if (onlyIfEmpty) query = query.is('multipart_upload_id', null)
  const { data, error } = await query
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data != null
}

export async function clearTrackedMultipartUpload(
  db: DbClient,
  r2Key: string,
  uploadId: string,
): Promise<void> {
  const { error } = await db
    .from('distributor_import_batches')
    .update({ multipart_upload_id: null, multipart_started_at: null })
    .eq('r2_key', r2Key)
    .eq('multipart_upload_id', uploadId)

  if (error) throw new Error(error.message)
}

export async function finalizeImportBatch(
  db: DbClient,
  input: { id: string; r2Key: string; fileHash: string },
): Promise<boolean> {
  const { data, error } = await db
    .from('distributor_import_batches')
    .update({
      r2_key: input.r2Key,
      file_hash: input.fileHash,
      status: 'completed',
      multipart_upload_id: null,
      multipart_started_at: null,
    })
    .eq('id', input.id)
    .neq('status', 'completed')
    .is('file_hash', null)
    .select('id')
    .maybeSingle()

  if (error) throw error
  return data != null
}

/** Delete an import batch row (and its bronze archive) unconditionally. */
export async function deleteImportBatch(db: DbClient, id: string): Promise<boolean> {
  const { data, error } = await db
    .from('distributor_import_batches')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data != null
}

/** @deprecated Use deleteImportBatch (confirmed deletes now supported). */
export const deleteUnconfirmedImportBatch = deleteImportBatch
