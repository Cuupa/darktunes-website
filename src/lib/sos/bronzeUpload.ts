/**
 * Client-side Bronze layer upload: raw distributor CSV → R2 via server-side API route.
 */

const MONTH_RE = /^\d{4}-\d{2}$/

export type BronzeDistributor = 'believe' | 'bandcamp' | 'shopify' | 'printful' | 'darkmerch'

export interface BronzeUploadParams {
  distributor: BronzeDistributor
  filename: string
  csvContent: string
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
    const fileHash = await sha256Hex(params.csvContent)
    const uploadFilename = params.filename.toLowerCase().endsWith('.xlsx')
      ? params.filename.replace(/\.xlsx$/i, '.csv')
      : params.filename

    const registerRes = await fetch('/api/admin/sos/import-batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_start: params.periodStart,
        period_end: params.periodEnd,
        distributor: params.distributor,
        filename: uploadFilename,
        file_hash: fileHash,
        row_count: params.rowCount,
        csv_content: params.csvContent,
      }),
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

    const { batch, r2Key } = (await registerRes.json()) as {
      batch: { id: string }
      r2Key: string
    }

    return { batchId: batch.id, r2Key }
  } catch (err) {
    console.error('[bronzeUpload] unexpected error:', err)
    return null
  }
}