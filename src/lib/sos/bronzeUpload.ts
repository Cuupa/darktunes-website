/**
 * Client-side Bronze layer upload: raw distributor CSV → R2.
 * Files ≤45 MB use a single server-side upload; larger files are sent in 20 MB chunks
 * via R2 multipart upload (no browser-to-R2 CORS required).
 */

import {
  BRONZE_UPLOAD_CHUNK_BYTES,
  MAX_BRONZE_CSV_BYTES,
  MAX_BRONZE_CSV_SERVER_BYTES,
} from '@/lib/sos/bronzeUploadLimits'

const MONTH_RE = /^\d{4}-\d{2}$/
const MAX_REGISTRATION_JSON_BYTES = 8_192

export type BronzeDistributor = 'believe' | 'bandcamp' | 'shopify' | 'printful' | 'darkmerch'

export interface BronzeUploadParams {
  distributor: BronzeDistributor
  filename: string
  /** Raw bytes to archive in R2 (CSV text or converted XLSX output). */
  uploadBody: Blob | ArrayBuffer | string
  contentType?: string
  rowCount: number
  periodStart: string
  periodEnd: string
}

export interface BronzeUploadResult {
  batchId: string
  r2Key: string
}

export function extractPeriodBounds(months: string[]): { periodStart: string; periodEnd: string } {
  const valid = months.filter((m) => MONTH_RE.test(m)).sort()
  const fallback = new Date().toISOString().slice(0, 7)
  return {
    periodStart: valid[0] ?? fallback,
    periodEnd: valid[valid.length - 1] ?? fallback,
  }
}

function toUploadBlob(body: Blob | ArrayBuffer | string, contentType: string): Blob {
  if (body instanceof Blob) return body
  if (typeof body === 'string') return new Blob([body], { type: contentType })
  return new Blob([body], { type: contentType })
}

export async function sha256HexFromBuffer(buffer: ArrayBuffer): Promise<string> {
  // Copy bytes so jsdom Blob.arrayBuffer() buffers work with Node Web Crypto in tests/CI.
  const bytes = new Uint8Array(buffer.byteLength)
  bytes.set(new Uint8Array(buffer))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** @deprecated Prefer sha256HexFromBuffer — kept for tests and legacy callers. */
export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const CONFIRM_MAX_ATTEMPTS = 3
const CONFIRM_RETRY_DELAY_MS = 500

async function abandonBronzeImportBatch(batchId: string): Promise<void> {
  try {
    const res = await fetch(`/api/admin/sos/import-batches/${batchId}`, { method: 'DELETE' })
    if (!res.ok) {
      console.error('[bronzeUpload] failed to abandon orphan batch:', batchId, res.status)
    }
  } catch (err) {
    console.error('[bronzeUpload] abandon orphan batch error:', err)
  }
}

async function markBronzeUploadFailed(batchId: string): Promise<void> {
  try {
    const res = await fetch(`/api/admin/sos/import-batches/${batchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'failed' }),
    })
    if (!res.ok) {
      console.error('[bronzeUpload] failed to mark batch as failed:', batchId, res.status)
    }
  } catch (err) {
    console.error('[bronzeUpload] mark batch failed error:', err)
  }
}

async function readApiErrorMessage(res: Response): Promise<string> {
  const errBody = await res.json().catch(() => ({}))
  return typeof errBody === 'object' && errBody && 'error' in errBody
    ? String((errBody as { error: unknown }).error)
    : res.statusText
}

async function abortBronzeMultipartUpload(batchId: string, uploadId: string): Promise<void> {
  try {
    await fetch(`/api/admin/sos/import-batches/${batchId}/multipart/abort`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_id: uploadId }),
    })
  } catch (err) {
    console.error('[bronzeUpload] multipart abort error:', err)
  }
}

async function uploadBronzeCsvMultipart(
  batchId: string,
  uploadBlob: Blob,
  uploadFilename: string,
  contentType: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let uploadId: string | undefined

  try {
    const initRes = await fetch(`/api/admin/sos/import-batches/${batchId}/multipart/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: contentType, file_size: uploadBlob.size }),
    })

    if (!initRes.ok) {
      return { ok: false, message: await readApiErrorMessage(initRes) }
    }

    const initJson = (await initRes.json()) as { uploadId?: string }
    uploadId = initJson.uploadId
    if (!uploadId) return { ok: false, message: 'Missing multipart upload ID' }

    const parts: { partNumber: number; etag: string }[] = []
    const totalParts = Math.ceil(uploadBlob.size / BRONZE_UPLOAD_CHUNK_BYTES)

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * BRONZE_UPLOAD_CHUNK_BYTES
      const end = Math.min(start + BRONZE_UPLOAD_CHUNK_BYTES, uploadBlob.size)
      const chunk = uploadBlob.slice(start, end)

      const partForm = new FormData()
      partForm.append('file', chunk, uploadFilename)
      partForm.append('upload_id', uploadId)
      partForm.append('part_number', String(partNumber))

      const partRes = await fetch(`/api/admin/sos/import-batches/${batchId}/multipart/part`, {
        method: 'POST',
        body: partForm,
      })

      if (!partRes.ok) {
        return { ok: false, message: await readApiErrorMessage(partRes) }
      }

      const partJson = (await partRes.json()) as { etag?: string; partNumber?: number }
      if (!partJson.etag || partJson.partNumber !== partNumber) {
        return { ok: false, message: 'Invalid multipart part response' }
      }

      parts.push({ partNumber, etag: partJson.etag })
    }

    const completeRes = await fetch(`/api/admin/sos/import-batches/${batchId}/multipart/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_id: uploadId, parts }),
    })

    if (!completeRes.ok) {
      return { ok: false, message: await readApiErrorMessage(completeRes) }
    }

    return { ok: true }
  } catch (err) {
    if (uploadId) await abortBronzeMultipartUpload(batchId, uploadId)
    throw err
  }
}

async function uploadBronzeCsvToR2(
  batchId: string,
  uploadBlob: Blob,
  uploadFilename: string,
  contentType: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (uploadBlob.size > MAX_BRONZE_CSV_SERVER_BYTES) {
    return uploadBronzeCsvMultipart(batchId, uploadBlob, uploadFilename, contentType)
  }

  const uploadForm = new FormData()
  uploadForm.append('file', uploadBlob, uploadFilename)

  const uploadRes = await fetch(`/api/admin/sos/import-batches/${batchId}/upload`, {
    method: 'POST',
    body: uploadForm,
  })

  if (!uploadRes.ok) {
    return { ok: false, message: await readApiErrorMessage(uploadRes) }
  }

  return { ok: true }
}

async function confirmBronzeUpload(batchId: string, fileHash: string): Promise<boolean> {
  for (let attempt = 1; attempt <= CONFIRM_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`/api/admin/sos/import-batches/${batchId}/confirm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_hash: fileHash }),
      })
      if (res.ok) return true
      console.error('[bronzeUpload] confirm attempt failed:', attempt, res.status)
    } catch (err) {
      console.error('[bronzeUpload] confirm attempt error:', attempt, err)
    }
    if (attempt < CONFIRM_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, CONFIRM_RETRY_DELAY_MS * attempt))
    }
  }
  return false
}

/**
 * Registers an import batch and uploads the raw CSV to R2.
 * Returns null on failure (local SOS processing should continue).
 */
export async function uploadBronzeDistributorCsv(
  params: BronzeUploadParams,
): Promise<BronzeUploadResult | null> {
  try {
    const contentType = params.contentType ?? 'text/csv; charset=utf-8'
    const uploadBlob = toUploadBlob(params.uploadBody, contentType)
    const uploadFilename = params.filename.toLowerCase().endsWith('.xlsx')
      ? params.filename.replace(/\.xlsx$/i, '.csv')
      : params.filename

    const fileHash = await sha256HexFromBuffer(await uploadBlob.arrayBuffer())

    const registerPayload = JSON.stringify({
      period_start: params.periodStart,
      period_end: params.periodEnd,
      distributor: params.distributor,
      filename: uploadFilename,
      row_count: params.rowCount,
      file_size: uploadBlob.size,
      file_hash: fileHash,
    })

    if (registerPayload.length > MAX_REGISTRATION_JSON_BYTES) {
      console.error('[bronzeUpload] registration metadata too large — file data must not be sent to the API')
      return null
    }

    const registerRes = await fetch('/api/admin/sos/import-batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: registerPayload,
    })

    if (!registerRes.ok) {
      const errBody = await registerRes.json().catch(() => ({}))
      const message =
        typeof errBody === 'object' && errBody && 'error' in errBody
          ? String((errBody as { error: unknown }).error)
          : registerRes.statusText
      console.error('[bronzeUpload] batch registration failed:', message)
      return null
    }

    const registerJson = (await registerRes.json()) as {
      batch: { id: string; r2Key?: string }
      r2Key?: string
      duplicate?: boolean
    }

    if (registerJson.duplicate) {
      return {
        batchId: registerJson.batch.id,
        r2Key: registerJson.batch.r2Key ?? registerJson.r2Key ?? '',
      }
    }

    const { batch, r2Key } = registerJson
    if (!batch?.id || !r2Key) {
      console.error('[bronzeUpload] invalid register response')
      return null
    }

    if (uploadBlob.size > MAX_BRONZE_CSV_BYTES) {
      console.error(
        '[bronzeUpload] CSV exceeds upload limit:',
        uploadBlob.size,
        'bytes (max',
        MAX_BRONZE_CSV_BYTES,
        ')',
      )
      await abandonBronzeImportBatch(batch.id)
      return null
    }

    const uploadResult = await uploadBronzeCsvToR2(batch.id, uploadBlob, uploadFilename, contentType)
    if (!uploadResult.ok) {
      console.error('[bronzeUpload] upload failed:', uploadResult.message)
      await abandonBronzeImportBatch(batch.id)
      return null
    }

    const confirmed = await confirmBronzeUpload(batch.id, fileHash)
    if (!confirmed) {
      console.error('[bronzeUpload] hash confirm failed after R2 PUT for batch:', batch.id)
      await markBronzeUploadFailed(batch.id)
      return null
    }

    return { batchId: batch.id, r2Key }
  } catch (err) {
    console.error('[bronzeUpload] unexpected error:', err)
    return null
  }
}