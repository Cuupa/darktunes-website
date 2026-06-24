/**
 * Client-side Bronze layer upload: raw distributor CSV → R2.
 * Files ≤45 MB use the server-side upload route; larger files use a presigned PUT URL
 * (requires R2 bucket CORS for the site origin).
 */

import { MAX_BRONZE_CSV_BYTES, MAX_BRONZE_CSV_SERVER_BYTES } from '@/lib/sos/bronzeUploadLimits'

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

async function uploadBronzeCsvToR2(
  batchId: string,
  uploadBlob: Blob,
  uploadFilename: string,
  contentType: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (uploadBlob.size > MAX_BRONZE_CSV_SERVER_BYTES) {
    const presignRes = await fetch(`/api/admin/sos/import-batches/${batchId}/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: contentType, file_size: uploadBlob.size }),
    })

    if (!presignRes.ok) {
      const presignErr = await presignRes.json().catch(() => ({}))
      const message =
        typeof presignErr === 'object' && presignErr && 'error' in presignErr
          ? String((presignErr as { error: unknown }).error)
          : presignRes.statusText
      return { ok: false, message }
    }

    const { uploadUrl } = (await presignRes.json()) as { uploadUrl?: string }
    if (!uploadUrl) return { ok: false, message: 'Missing presigned upload URL' }

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: uploadBlob,
      headers: { 'Content-Type': contentType },
    })

    if (!putRes.ok) {
      return { ok: false, message: `Direct R2 upload failed (${putRes.status})` }
    }

    return { ok: true }
  }

  const uploadForm = new FormData()
  uploadForm.append('file', uploadBlob, uploadFilename)

  const uploadRes = await fetch(`/api/admin/sos/import-batches/${batchId}/upload`, {
    method: 'POST',
    body: uploadForm,
  })

  if (!uploadRes.ok) {
    const uploadErr = await uploadRes.json().catch(() => ({}))
    const message =
      typeof uploadErr === 'object' && uploadErr && 'error' in uploadErr
        ? String((uploadErr as { error: unknown }).error)
        : uploadRes.statusText
    return { ok: false, message }
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