/**
 * Client-side Bronze layer upload: raw distributor CSV → R2 via presigned PUT.
 * Large files bypass Vercel's 4.5 MB body limit by uploading directly to R2.
 */

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
  const hash = await crypto.subtle.digest('SHA-256', buffer)
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

    const registerPayload = JSON.stringify({
      period_start: params.periodStart,
      period_end: params.periodEnd,
      distributor: params.distributor,
      filename: uploadFilename,
      row_count: params.rowCount,
      file_size: uploadBlob.size,
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

    const { batch, uploadUrl, r2Key } = (await registerRes.json()) as {
      batch: { id: string }
      uploadUrl: string
      r2Key: string
    }

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: uploadBlob,
      headers: { 'Content-Type': contentType },
    })

    if (!putRes.ok) {
      console.error('[bronzeUpload] R2 PUT failed:', putRes.status, putRes.statusText)
      return null
    }

    const fileHash = await sha256HexFromBuffer(await uploadBlob.arrayBuffer())
    void fetch(`/api/admin/sos/import-batches/${batch.id}/confirm`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_hash: fileHash }),
    }).catch(() => undefined)

    return { batchId: batch.id, r2Key }
  } catch (err) {
    console.error('[bronzeUpload] unexpected error:', err)
    return null
  }
}