/**
 * Client-side Bronze layer upload: raw distributor CSV → R2.
 *
 * Primary (supported) route: presigned direct browser → R2 (single PUT or
 * multipart with 64 MB parts). Requires R2 bucket CORS — see DEPLOYMENT.md.
 * Small-file fallback when direct is disabled: server proxy single request
 * (≤ 4 MB). There is deliberately no server-proxy multipart path: R2 rejects
 * non-final parts below 5 MiB.
 */

import { logClientAppEvent } from '@/lib/sos/clientAppLog'
import { explainSosError } from '@/lib/sos/explainSosError'
import {
  BRONZE_DIRECT_UPLOAD_PART_BYTES,
  BRONZE_R2_MIN_PART_BYTES,
  BRONZE_SINGLE_PUT_MAX_BYTES,
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

export type BronzeUploadOutcome =
  | { ok: true; batchId: string; r2Key: string }
  | { ok: false; message: string }

export function isBronzeDirectUploadEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BRONZE_DIRECT_UPLOAD !== 'false'
}

/**
 * Derives the reporting-period bounds of a parsed source file. Returns `null`
 * when the file exposes no valid `YYYY-MM` month — the caller must skip the
 * archive instead of inventing the current month.
 */
export function extractPeriodBounds(
  months: string[],
): { periodStart: string; periodEnd: string } | null {
  const valid = months.filter((m) => MONTH_RE.test(m)).sort()
  if (valid.length === 0) return null
  return {
    periodStart: valid[0],
    periodEnd: valid[valid.length - 1],
  }
}

function toUploadBlob(body: Blob | ArrayBuffer | string, contentType: string): Blob {
  if (body instanceof Blob) return body
  if (typeof body === 'string') return new Blob([body], { type: contentType })
  return new Blob([body], { type: contentType })
}

export async function sha256HexFromBuffer(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const TRANSIENT_FETCH_RE = /failed to fetch|networkerror|load failed|network request failed/i

export function isTransientBronzeFetchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return TRANSIENT_FETCH_RE.test(message)
}

export function humanizeBronzeUploadError(message: string): string {
  return explainSosError(message)
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

async function logBronzeError(message: string, details?: Record<string, unknown>): Promise<void> {
  console.error('[bronzeUpload]', message, details ?? '')
  await logClientAppEvent('sos.bronze.upload', message, 'error', details)
}

async function abandonBronzeImportBatch(batchId: string): Promise<void> {
  try {
    const res = await fetch(`/api/admin/sos/import-batches/${batchId}`, { method: 'DELETE' })
    if (!res.ok) {
      await logBronzeError('failed to abandon orphan batch', { batchId, status: res.status })
    }
  } catch (err) {
    await logBronzeError('abandon orphan batch error', {
      batchId,
      error: err instanceof Error ? err.message : String(err),
    })
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
      await logBronzeError('failed to mark batch as failed', { batchId, status: res.status })
    }
  } catch (err) {
    await logBronzeError('mark batch failed error', {
      batchId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function readApiErrorMessage(res: Response): Promise<string> {
  if (res.status === 413) {
    return 'Upload too large for server proxy (max 4 MB per request)'
  }
  const errBody = await res.json().catch(() => ({}))
  return typeof errBody === 'object' && errBody && 'error' in errBody
    ? String((errBody as { error: unknown }).error)
    : res.statusText || `HTTP ${res.status}`
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

function normalizeEtag(etag: string | null): string {
  if (!etag) throw new Error('Missing ETag from R2 upload')
  return etag.replace(/"/g, '')
}

async function putToPresignedUrl(url: string, body: Blob, contentType: string): Promise<string> {
  const attempt = async (): Promise<string> => {
    const res = await fetch(url, {
      method: 'PUT',
      body,
      headers: { 'Content-Type': contentType },
    })
    if (!res.ok) {
      throw new Error(`R2 PUT failed (${res.status})`)
    }
    return normalizeEtag(res.headers.get('ETag') ?? res.headers.get('etag'))
  }
  try {
    return await attempt()
  } catch (err) {
    if (!isTransientBronzeFetchError(err)) throw err
    return await attempt()
  }
}

async function uploadBronzeCsvDirectSingle(
  batchId: string,
  uploadBlob: Blob,
  contentType: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const presignRes = await fetch(`/api/admin/sos/import-batches/${batchId}/presign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_type: contentType, file_size: uploadBlob.size }),
  })
  if (!presignRes.ok) {
    return { ok: false, message: await readApiErrorMessage(presignRes) }
  }

  const presignJson = (await presignRes.json()) as { uploadUrl?: string }
  if (!presignJson.uploadUrl) return { ok: false, message: 'Missing presigned upload URL' }

  try {
    await putToPresignedUrl(presignJson.uploadUrl, uploadBlob, contentType)
    return { ok: true }
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Direct R2 upload failed'
    return { ok: false, message: humanizeBronzeUploadError(raw) }
  }
}

async function uploadBronzeCsvDirectMultipart(
  batchId: string,
  uploadBlob: Blob,
  contentType: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let uploadId: string | undefined

  /** Abort the multipart session on every failure path — no orphaned UploadId. */
  const fail = async (message: string): Promise<{ ok: false; message: string }> => {
    if (uploadId) await abortBronzeMultipartUpload(batchId, uploadId)
    return { ok: false, message }
  }

  try {
    const initRes = await fetch(`/api/admin/sos/import-batches/${batchId}/multipart/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: contentType, file_size: uploadBlob.size }),
    })
    if (!initRes.ok) {
      return fail(await readApiErrorMessage(initRes))
    }

    const initJson = (await initRes.json()) as { uploadId?: string }
    uploadId = initJson.uploadId
    if (!uploadId) return fail('Missing multipart upload ID')

    const parts: { partNumber: number; etag: string }[] = []
    const totalParts = Math.ceil(uploadBlob.size / BRONZE_DIRECT_UPLOAD_PART_BYTES)

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * BRONZE_DIRECT_UPLOAD_PART_BYTES
      const end = Math.min(start + BRONZE_DIRECT_UPLOAD_PART_BYTES, uploadBlob.size)
      const chunk = uploadBlob.slice(start, end)

      // R2 rejects non-final parts below 5 MiB; fail loudly instead of letting
      // the provider reject the complete request.
      if (partNumber < totalParts && chunk.size < BRONZE_R2_MIN_PART_BYTES) {
        return fail(
          `Multipart part ${partNumber} is below the R2 minimum of ${BRONZE_R2_MIN_PART_BYTES} bytes`,
        )
      }

      const presignRes = await fetch(
        `/api/admin/sos/import-batches/${batchId}/multipart/presign-part`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ upload_id: uploadId, part_number: partNumber }),
        },
      )
      if (!presignRes.ok) {
        return fail(await readApiErrorMessage(presignRes))
      }

      const presignJson = (await presignRes.json()) as { uploadUrl?: string }
      if (!presignJson.uploadUrl) {
        return fail('Missing presigned part URL')
      }

      const etag = await putToPresignedUrl(presignJson.uploadUrl, chunk, contentType)
      parts.push({ partNumber, etag })
    }

    const completeRes = await fetch(`/api/admin/sos/import-batches/${batchId}/multipart/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_id: uploadId, parts }),
    })
    if (!completeRes.ok) {
      return fail(await readApiErrorMessage(completeRes))
    }

    return { ok: true }
  } catch (err) {
    if (uploadId) await abortBronzeMultipartUpload(batchId, uploadId)
    throw err
  }
}

async function uploadBronzeCsvDirect(
  batchId: string,
  uploadBlob: Blob,
  contentType: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (uploadBlob.size <= BRONZE_SINGLE_PUT_MAX_BYTES) {
    return uploadBronzeCsvDirectSingle(batchId, uploadBlob, contentType)
  }
  return uploadBronzeCsvDirectMultipart(batchId, uploadBlob, contentType)
}

/** Server proxy fallback: one request, only for small files. */
async function uploadBronzeCsvProxySingle(
  batchId: string,
  uploadBlob: Blob,
  uploadFilename: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
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

async function uploadBronzeCsvToR2(
  batchId: string,
  uploadBlob: Blob,
  uploadFilename: string,
  contentType: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (isBronzeDirectUploadEnabled()) {
    // No silent proxy fallback: a failing direct route (usually missing R2
    // CORS) must surface its error instead of hiding behind a broken path.
    return uploadBronzeCsvDirect(batchId, uploadBlob, contentType)
  }

  if (uploadBlob.size > MAX_BRONZE_CSV_SERVER_BYTES) {
    return {
      ok: false,
      message: `Direct R2 upload is disabled. Files above ${Math.round(
        MAX_BRONZE_CSV_SERVER_BYTES / (1024 * 1024),
      )} MB require the presigned route (R2 bucket CORS).`,
    }
  }

  return uploadBronzeCsvProxySingle(batchId, uploadBlob, uploadFilename)
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
 * Returns `{ ok: false, message }` on failure (local SOS processing continues).
 */
export async function uploadBronzeDistributorCsv(
  params: BronzeUploadParams,
): Promise<BronzeUploadOutcome> {
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
      const message = 'registration metadata too large'
      await logBronzeError(message)
      return { ok: false, message }
    }

    const registerRes = await fetch('/api/admin/sos/import-batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: registerPayload,
    })

    if (!registerRes.ok) {
      const message = await readApiErrorMessage(registerRes)
      await logBronzeError('batch registration failed', { message })
      return { ok: false, message }
    }

    const registerJson = (await registerRes.json()) as {
      batch: { id: string; r2Key?: string }
      r2Key?: string
      duplicate?: boolean
    }

    if (registerJson.duplicate) {
      return {
        ok: true,
        batchId: registerJson.batch.id,
        r2Key: registerJson.batch.r2Key ?? registerJson.r2Key ?? '',
      }
    }

    const { batch, r2Key } = registerJson
    if (!batch?.id || !r2Key) {
      const message = 'invalid register response'
      await logBronzeError(message)
      return { ok: false, message }
    }

    if (uploadBlob.size > MAX_BRONZE_CSV_BYTES) {
      const message = `CSV exceeds upload limit (max ${MAX_BRONZE_CSV_BYTES} bytes)`
      await logBronzeError('CSV exceeds upload limit', {
        size: uploadBlob.size,
        max: MAX_BRONZE_CSV_BYTES,
      })
      await abandonBronzeImportBatch(batch.id)
      return { ok: false, message }
    }

    const uploadResult = await uploadBronzeCsvToR2(batch.id, uploadBlob, uploadFilename, contentType)
    if (!uploadResult.ok) {
      await logBronzeError('upload failed', { message: uploadResult.message, batchId: batch.id })
      await abandonBronzeImportBatch(batch.id)
      return { ok: false, message: uploadResult.message }
    }

    const confirmed = await confirmBronzeUpload(batch.id, fileHash)
    if (!confirmed) {
      const message = 'Archive confirm failed after upload'
      await logBronzeError('hash confirm failed after R2 upload', { batchId: batch.id })
      await markBronzeUploadFailed(batch.id)
      return { ok: false, message }
    }

    return { ok: true, batchId: batch.id, r2Key }
  } catch (err) {
    const message = humanizeBronzeUploadError(err instanceof Error ? err.message : String(err))
    await logBronzeError('unexpected error', { error: message })
    return { ok: false, message }
  }
}