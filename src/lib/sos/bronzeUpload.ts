/**
 * Client-side Bronze layer upload: raw distributor CSV → R2.
 *
 * Primary (supported) route: presigned direct browser → R2 (single PUT for
 * small files, multipart with 16 MB parts above). Requires R2 bucket CORS —
 * see DEPLOYMENT.md. Presign uses an R2 client with flexible checksums off.
 * Every PUT retries with a freshly signed URL on a dropped connection.
 * Small-file fallback when direct is disabled: server proxy single request
 * (≤ 4 MB). There is deliberately no server-proxy multipart path: R2 rejects
 * non-final parts below 5 MiB.
 */

import { logClientAppEvent } from '@/lib/sos/clientAppLog'
import { explainSosError } from '@/lib/sos/explainSosError'
import {
  BRONZE_DIRECT_UPLOAD_PART_BYTES,
  BRONZE_R2_MIN_PART_BYTES,
  MAX_BRONZE_CSV_BYTES,
  MAX_BRONZE_CSV_SERVER_BYTES,
  planBronzeDirectUpload,
} from '@/lib/sos/bronzeUploadLimits'

const MONTH_RE = /^\d{4}-\d{2}$/
const MAX_REGISTRATION_JSON_BYTES = 8_192

export type BronzeDistributor = 'believe' | 'bandcamp' | 'shopify' | 'printful' | 'darkmerch'

export interface BronzeUploadParams {
  operationId?: string
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
  | { ok: false; message: string; phase?: 'confirm' }

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
  // Pass a typed-array view: WebCrypto rejects foreign-realm ArrayBuffers
  // (jsdom in tests), while views are accepted across realms.
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(buffer))
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const TRANSIENT_FETCH_RE = /failed to fetch|networkerror|load failed|network request failed/i

export function isTransientBronzeFetchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return TRANSIENT_FETCH_RE.test(message)
}

export function humanizeBronzeUploadError(message: unknown): string {
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
const API_REQUEST_TIMEOUT_MS = 60_000
const ABORT_REQUEST_TIMEOUT_MS = 15_000
const CONFIRM_MIN_TIMEOUT_MS = 30_000
const CONFIRM_MAX_TIMEOUT_MS = 5 * 60_000

async function logBronzeError(
  message: string,
  operationId: string,
  details?: Record<string, unknown>,
): Promise<void> {
  console.error('[bronzeUpload]', message, details ?? '')
  await logClientAppEvent(`sos.bronze.upload.${operationId}`, message, 'error', {
    ...details,
    operation_id: operationId,
  })
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = API_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function confirmTimeoutMs(fileSize: number): number {
  return Math.min(CONFIRM_MAX_TIMEOUT_MS, Math.max(CONFIRM_MIN_TIMEOUT_MS, 30_000 + fileSize / 100_000))
}

async function logBronzePhase(
  operationId: string,
  batchId: string | undefined,
  phase: 'register' | 'upload' | 'confirm',
  startedAt: number,
  outcome: 'completed' | 'failed',
  details: Record<string, unknown>,
): Promise<void> {
  await logClientAppEvent(
    `sos.bronze.upload.${operationId}`,
    `Bronze ${phase} ${outcome}`,
    outcome === 'failed' ? 'error' : 'info',
    {
      operation_id: operationId,
      batch_id: batchId,
      phase,
      duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
      ...details,
    },
  )
}

async function abandonBronzeImportBatch(batchId: string, operationId: string): Promise<void> {
  try {
    const res = await fetchWithTimeout(
      `/api/admin/sos/import-batches/${batchId}`,
      { method: 'DELETE' },
      ABORT_REQUEST_TIMEOUT_MS,
    )
    if (!res.ok) {
      await logBronzeError('failed to abandon orphan batch', operationId, {
        batch_id: batchId,
        status: res.status,
      })
    }
  } catch (err) {
    await logBronzeError('abandon orphan batch error', operationId, {
      batch_id: batchId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function readApiErrorMessage(res: Response): Promise<string> {
  if (res.status === 413) {
    return 'Upload too large for server proxy (max 4 MB per request)'
  }
  const errBody = await res.json().catch(() => ({}))
  if (typeof errBody === 'object' && errBody) {
    // problem+json carries the message in `detail`; `error` is the legacy alias.
    const body = errBody as { detail?: unknown; error?: unknown }
    if (typeof body.detail === 'string' && body.detail.trim()) return body.detail
    if (typeof body.error === 'string' && body.error.trim()) return body.error
  }
  return res.statusText || `HTTP ${res.status}`
}

async function abortBronzeMultipartUpload(batchId: string, operationId: string): Promise<void> {
  try {
    const res = await fetchWithTimeout(`/api/admin/sos/import-batches/${batchId}/multipart/abort`, {
      method: 'POST',
    }, ABORT_REQUEST_TIMEOUT_MS)
    if (!res.ok) {
      await logBronzeError('multipart abort request failed', operationId, {
        batch_id: batchId,
        status: res.status,
      })
    }
  } catch (err) {
    await logBronzeError('multipart abort request error', operationId, {
      batch_id: batchId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * `final` messages are already user-facing (a server problem detail); anything
 * else is a transport level failure and goes through `humanizeBronzeUploadError`.
 */
class BronzeUploadError extends Error {
  readonly final: boolean
  constructor(message: string, final = false) {
    super(message)
    this.name = 'BronzeUploadError'
    this.final = final
  }
}

function toBronzeMessage(err: unknown): string {
  if (err instanceof BronzeUploadError && err.final) return err.message
  // Browser → R2 CORS/signature failures surface as Failed to fetch, not as HTTP 403.
  if (isTransientBronzeFetchError(err)) {
    return humanizeBronzeUploadError('R2 PUT failed (blocked request)')
  }
  const raw = err instanceof Error ? err.message : 'Direct R2 upload failed'
  return humanizeBronzeUploadError(raw)
}

function normalizeEtag(etag: string | null): string {
  // Non-final: explained as a storage/CORS problem (no internals leaked).
  if (!etag) throw new BronzeUploadError('R2 PUT failed (missing ETag)')
  return etag.replace(/"/g, '')
}

const PUT_MAX_ATTEMPTS = 4
const PUT_RETRY_BASE_DELAY_MS = 300
const PUT_ATTEMPT_MIN_TIMEOUT_MS = 2 * 60 * 1000
const PUT_ATTEMPT_MAX_TIMEOUT_MS = 14 * 60 * 1000
/** Throughput we assume before giving up on one attempt (~160 kbps). */
const PUT_ASSUMED_MIN_BYTES_PER_SEC = 20_000

/**
 * Per-attempt cap, scaled to the body so a slow-but-working link is not cut
 * off, but bounded below the 900 s presign lifetime.
 */
function putAttemptTimeoutMs(bodySize: number): number {
  const scaled = (bodySize / PUT_ASSUMED_MIN_BYTES_PER_SEC) * 1000
  return Math.min(PUT_ATTEMPT_MAX_TIMEOUT_MS, Math.max(PUT_ATTEMPT_MIN_TIMEOUT_MS, scaled))
}

function isRetryableR2PutError(error: unknown): boolean {
  if (isTransientBronzeFetchError(error)) return true
  if (error instanceof Error && error.name === 'AbortError') return true
  const message = error instanceof Error ? error.message : String(error)
  if (/abort/i.test(message)) return true
  // 403 = presign expired mid-transfer; 4xx/5xx = R2 or proxy hiccup.
  return /R2 PUT failed \((403|408|425|429|5\d\d)\)/.test(message)
}

async function putOnce(url: string, body: Blob, contentType?: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), putAttemptTimeoutMs(body.size))
  try {
    const res = await fetch(url, {
      method: 'PUT',
      body,
      headers: contentType ? { 'Content-Type': contentType } : undefined,
      signal: controller.signal,
    })
    if (!res.ok) throw new BronzeUploadError(`R2 PUT failed (${res.status})`)
    return normalizeEtag(res.headers.get('ETag') ?? res.headers.get('etag'))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Uploads `body` to a presigned R2 PUT URL, retrying on a dropped connection or
 * an expired signature with a **freshly signed** URL each time. Each attempt is
 * bounded by a timeout so a stalled connection cannot hang the archive queue.
 */
async function putToPresignedUrl(
  initialUrl: string,
  body: Blob,
  contentType: string | undefined,
  resign: () => Promise<string>,
): Promise<string> {
  let url = initialUrl
  for (let attempt = 1; ; attempt++) {
    try {
      return await putOnce(url, body, contentType)
    } catch (err) {
      if (attempt >= PUT_MAX_ATTEMPTS || !isRetryableR2PutError(err)) throw err
      await new Promise((resolve) => setTimeout(resolve, PUT_RETRY_BASE_DELAY_MS * attempt))
      url = await resign()
    }
  }
}

const PRESIGN_TIMEOUT_MS = 60_000

async function postBronzePresignUrl(
  path: string,
  body: Record<string, unknown>,
  missingMessage: string,
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PRESIGN_TIMEOUT_MS)
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) throw new BronzeUploadError(await readApiErrorMessage(res), true)
    const json = (await res.json()) as { uploadUrl?: string }
    if (!json.uploadUrl) throw new BronzeUploadError(missingMessage, true)
    return json.uploadUrl
  } finally {
    clearTimeout(timer)
  }
}

function requestBronzePresignedUploadUrl(
  batchId: string,
  contentType: string,
  fileSize: number,
): Promise<string> {
  return postBronzePresignUrl(
    `/api/admin/sos/import-batches/${batchId}/presign-upload`,
    { content_type: contentType, file_size: fileSize },
    'Missing presigned upload URL',
  )
}

function requestBronzePresignedPartUrl(
  batchId: string,
  uploadId: string,
  partNumber: number,
): Promise<string> {
  return postBronzePresignUrl(
    `/api/admin/sos/import-batches/${batchId}/multipart/presign-part`,
    { upload_id: uploadId, part_number: partNumber },
    'Missing presigned part URL',
  )
}

async function uploadBronzeCsvDirectSingle(
  batchId: string,
  uploadBlob: Blob,
  contentType: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const sign = () => requestBronzePresignedUploadUrl(batchId, contentType, uploadBlob.size)
  try {
    await putToPresignedUrl(await sign(), uploadBlob, contentType, sign)
    return { ok: true }
  } catch (err) {
    return { ok: false, message: toBronzeMessage(err) }
  }
}

async function uploadBronzeCsvDirectMultipart(
  batchId: string,
  operationId: string,
  uploadBlob: Blob,
  contentType: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let uploadId: string | undefined

  /** Abort the multipart session on every failure path — no orphaned UploadId. */
  const fail = async (message: string): Promise<{ ok: false; message: string }> => {
    await abortBronzeMultipartUpload(batchId, operationId)
    return { ok: false, message }
  }

  try {
    const initRes = await fetchWithTimeout(`/api/admin/sos/import-batches/${batchId}/multipart/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: contentType, file_size: uploadBlob.size }),
    })
    if (!initRes.ok) {
      return fail(await readApiErrorMessage(initRes))
    }

    const initJson = (await initRes.json()) as { uploadId?: string | null; completed?: boolean }
    if (initJson.completed) return { ok: true }
    uploadId = typeof initJson.uploadId === 'string' ? initJson.uploadId : undefined
    if (!uploadId) return fail('Missing multipart upload ID')

    const parts: { partNumber: number; etag: string }[] = []
    const { partCount: totalParts } = planBronzeDirectUpload(uploadBlob.size)

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

      const sign = () => requestBronzePresignedPartUrl(batchId, uploadId as string, partNumber)
      const etag = await putToPresignedUrl(await sign(), chunk, undefined, sign)
      parts.push({ partNumber, etag })
    }

    const completeRes = await fetchWithTimeout(`/api/admin/sos/import-batches/${batchId}/multipart/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_id: uploadId, parts }),
    })
    if (!completeRes.ok) {
      return fail(await readApiErrorMessage(completeRes))
    }

    return { ok: true }
  } catch (err) {
    await abortBronzeMultipartUpload(batchId, operationId)
    return { ok: false, message: toBronzeMessage(err) }
  }
}

async function uploadBronzeCsvDirect(
  batchId: string,
  operationId: string,
  uploadBlob: Blob,
  contentType: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (planBronzeDirectUpload(uploadBlob.size).mode === 'single-put') {
    return uploadBronzeCsvDirectSingle(batchId, uploadBlob, contentType)
  }
  return uploadBronzeCsvDirectMultipart(batchId, operationId, uploadBlob, contentType)
}

/** Server proxy fallback: one request, only for small files. */
async function uploadBronzeCsvProxySingle(
  batchId: string,
  uploadBlob: Blob,
  uploadFilename: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const uploadForm = new FormData()
  uploadForm.append('file', uploadBlob, uploadFilename)
  const uploadRes = await fetchWithTimeout(`/api/admin/sos/import-batches/${batchId}/upload`, {
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
  operationId: string,
  uploadBlob: Blob,
  uploadFilename: string,
  contentType: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (isBronzeDirectUploadEnabled()) {
    // No silent proxy fallback: a failing direct route (usually missing R2
    // CORS) must surface its error instead of hiding behind a broken path.
    return uploadBronzeCsvDirect(batchId, operationId, uploadBlob, contentType)
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

async function confirmBronzeUpload(
  batchId: string,
  operationId: string,
  fileHash: string,
  fileSize: number,
): Promise<{
  confirmed: boolean
  attempts: number
  duplicateBatch?: { id: string; r2Key?: string }
  confirmedR2Key?: string
}> {
  const deadline = performance.now() + confirmTimeoutMs(fileSize)
  for (let attempt = 1; attempt <= CONFIRM_MAX_ATTEMPTS; attempt++) {
    const remainingMs = Math.floor(deadline - performance.now())
    if (remainingMs <= 0) return { confirmed: false, attempts: attempt - 1 }
    try {
      const res = await fetchWithTimeout(`/api/admin/sos/import-batches/${batchId}/confirm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_hash: fileHash, operation_id: operationId }),
      }, remainingMs)
      if (res.ok) {
        const result = ((await res.json?.().catch(() => ({}))) ?? {}) as {
          duplicate?: boolean
          batch?: { id: string; r2Key?: string }
          r2Key?: string
        }
        return {
          confirmed: true,
          attempts: attempt,
          duplicateBatch: result.duplicate ? result.batch : undefined,
          confirmedR2Key: result.r2Key,
        }
      }
      console.error('[bronzeUpload] confirm attempt failed:', attempt, res.status)
    } catch (err) {
      console.error('[bronzeUpload] confirm attempt error:', attempt, err)
    }
    if (attempt < CONFIRM_MAX_ATTEMPTS) {
      const delay = Math.min(CONFIRM_RETRY_DELAY_MS * attempt, Math.max(0, deadline - performance.now()))
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  return { confirmed: false, attempts: CONFIRM_MAX_ATTEMPTS }
}

/**
 * Registers an import batch and uploads the raw CSV to R2.
 * Returns `{ ok: false, message }` on failure (local SOS processing continues).
 */
export async function uploadBronzeDistributorCsv(
  params: BronzeUploadParams,
): Promise<BronzeUploadOutcome> {
  const operationId = params.operationId ?? crypto.randomUUID()
  let batchId: string | undefined
  let currentPhase: 'register' | 'upload' | 'confirm' = 'register'
  let phaseStartedAt = performance.now()
  let fileSizeBytes = 0
  try {
    const contentType = params.contentType ?? 'text/csv; charset=utf-8'
    const uploadBlob = toUploadBlob(params.uploadBody, contentType)
    fileSizeBytes = uploadBlob.size
    const uploadFilename = params.filename.toLowerCase().endsWith('.xlsx')
      ? params.filename.replace(/\.xlsx$/i, '.csv')
      : params.filename

    if (uploadBlob.size > MAX_BRONZE_CSV_BYTES) {
      const message = `CSV exceeds upload limit (max ${MAX_BRONZE_CSV_BYTES} bytes)`
      await logBronzeError('CSV exceeds upload limit', operationId, {
        size_bytes: uploadBlob.size,
        max_bytes: MAX_BRONZE_CSV_BYTES,
      })
      return { ok: false, message }
    }

    // shortcut: the whole file is buffered once to hash it (WebCrypto has no
    // streaming digest); fine for the ~60-70 MB reference CSVs, revisit if the
    // 1 GB bronze cap becomes common.
    const fileHash = await sha256HexFromBuffer(await uploadBlob.arrayBuffer())

    const registerPayload = JSON.stringify({
      operation_id: operationId,
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
      await logBronzeError(message, operationId, { phase: 'register' })
      return { ok: false, message }
    }

    const registerStartedAt = performance.now()
    phaseStartedAt = registerStartedAt
    const registerRes = await fetchWithTimeout('/api/admin/sos/import-batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: registerPayload,
    })

    if (!registerRes.ok) {
      const message = await readApiErrorMessage(registerRes)
      await logBronzePhase(operationId, undefined, 'register', registerStartedAt, 'failed', {
        file_size_bytes: uploadBlob.size,
        row_count: params.rowCount,
        status: registerRes.status,
      })
      await logBronzeError('batch registration failed', operationId, { message, status: registerRes.status })
      return { ok: false, message }
    }

    const registerJson = (await registerRes.json()) as {
      batch: { id: string; r2Key?: string }
      r2Key?: string
      duplicate?: boolean
    }

    if (registerJson.duplicate) {
      await logBronzePhase(operationId, registerJson.batch?.id, 'register', registerStartedAt, 'completed', {
        file_size_bytes: uploadBlob.size,
        row_count: params.rowCount,
        duplicate: true,
      })
      return {
        ok: true,
        batchId: registerJson.batch.id,
        r2Key: registerJson.batch.r2Key ?? registerJson.r2Key ?? '',
      }
    }

    const { batch, r2Key } = registerJson
    if (!batch?.id || !r2Key) {
      const message = 'invalid register response'
      await logBronzeError(message, operationId, { phase: 'register' })
      return { ok: false, message }
    }
    batchId = batch.id
    await logBronzePhase(operationId, batchId, 'register', registerStartedAt, 'completed', {
      file_size_bytes: uploadBlob.size,
      row_count: params.rowCount,
      duplicate: false,
    })

    currentPhase = 'upload'
    const uploadStartedAt = performance.now()
    phaseStartedAt = uploadStartedAt
    const uploadResult = await uploadBronzeCsvToR2(
      batch.id,
      operationId,
      uploadBlob,
      uploadFilename,
      contentType,
    )
    await logBronzePhase(operationId, batch.id, 'upload', uploadStartedAt, uploadResult.ok ? 'completed' : 'failed', {
      file_size_bytes: uploadBlob.size,
      row_count: params.rowCount,
      transport: isBronzeDirectUploadEnabled() ? 'direct-r2' : 'server-proxy',
    })
    if (!uploadResult.ok) {
      await logBronzeError('upload failed', operationId, {
        message: uploadResult.message,
        batch_id: batch.id,
      })
      await abandonBronzeImportBatch(batch.id, operationId)
      return { ok: false, message: uploadResult.message }
    }

    currentPhase = 'confirm'
    const confirmStartedAt = performance.now()
    phaseStartedAt = confirmStartedAt
    const confirmResult = await confirmBronzeUpload(batch.id, operationId, fileHash, uploadBlob.size)
    await logBronzePhase(operationId, batch.id, 'confirm', confirmStartedAt, confirmResult.confirmed ? 'completed' : 'failed', {
      file_size_bytes: uploadBlob.size,
      row_count: params.rowCount,
      attempts: confirmResult.attempts,
    })
    if (!confirmResult.confirmed) {
      const message = 'Archive confirm failed after upload'
      await logBronzeError('hash confirm failed after R2 upload', operationId, { batch_id: batch.id })
      return { ok: false, message, phase: 'confirm' }
    }

    return {
      ok: true,
      batchId: confirmResult.duplicateBatch?.id ?? batch.id,
      r2Key: confirmResult.duplicateBatch?.r2Key ?? confirmResult.confirmedR2Key ?? r2Key,
    }
  } catch (err) {
    const message = humanizeBronzeUploadError(err)
    await logBronzePhase(operationId, batchId, currentPhase, phaseStartedAt, 'failed', {
      file_size_bytes: fileSizeBytes,
      row_count: params.rowCount,
    })
    await logBronzeError('unexpected error', operationId, {
      batch_id: batchId,
      phase: currentPhase,
      error: message,
    })
    if (batchId && currentPhase === 'upload') {
      await abortBronzeMultipartUpload(batchId, operationId)
      await abandonBronzeImportBatch(batchId, operationId)
    }
    return { ok: false, message }
  }
}
