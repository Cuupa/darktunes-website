/**
 * sosWebhook – darkTunes portal statement upload integration.
 *
 * Implements a 3-step presigned-URL flow:
 *   1. POST /api/webhooks/sos       -> receive { uploadUrl, r2Key }
 *   2. PUT  <uploadUrl>             -> upload PDF directly to R2
 *   3. POST /api/webhooks/sos/confirm -> persist DB record + trigger e-mail
 *
 * The `fetch` parameter follows Dependency Injection for testability.
 */

/** UUID regex - validates v4 UUIDs (also accepts v1-v5 and nil UUID). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Period string must be `YYYY-MM` or `Q{N}-YYYY`. */
const PERIOD_RE = /^(\d{4}-\d{2}|Q[1-4]-\d{4})$/

/** Maximum PDF size allowed for upload (10 MiB). */
const MAX_PDF_BYTES = 10 * 1024 * 1024

export interface SosUploadRequest {
  /** UUID of the artist in the darkTunes portal (artists.id). */
  artistId: string
  /** Filename, e.g. "Statement_Q1-2024_BandName.pdf". */
  filename: string
  /** Reporting period in `YYYY-MM` or `Q{N}-YYYY` format. */
  period: string
  /** Net payout amount in EUR (optional). */
  amountEur?: number
}

export interface SosUploadResult {
  success: boolean
  error?: string
}

/**
 * Uploads a Statement-of-Sales PDF to the darkTunes R2 storage via a
 * presigned URL and confirms the upload so the portal can persist the
 * record and send an e-mail notification to the artist.
 *
 * @param request     Metadata about the statement to upload.
 * @param pdfBlob     The PDF file as a Blob.
 * @param webhookUrl  Base URL of the SOS webhook endpoint,
 *                    e.g. `https://darktunes.com/api/webhooks/sos`.
 * @param apiKey      Shared-secret API key sent as `Authorization: Bearer`.
 * @param fetchFn     Fetch implementation (default: `globalThis.fetch`).
 *                    Inject a mock for unit tests.
 */
export async function uploadStatementPdf(
  request: SosUploadRequest,
  pdfBlob: Blob,
  webhookUrl: string,
  apiKey: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<SosUploadResult> {
  // -- Pre-flight validation -------------------------------------------------
  if (!UUID_RE.test(request.artistId)) {
    return { success: false, error: `Invalid artistId format: "${request.artistId}"` }
  }
  if (!PERIOD_RE.test(request.period)) {
    return { success: false, error: `Invalid period format: "${request.period}" (expected YYYY-MM or Q{N}-YYYY)` }
  }
  if (pdfBlob.size > MAX_PDF_BYTES) {
    return {
      success: false,
      error: `PDF size ${(pdfBlob.size / 1024 / 1024).toFixed(1)} MB exceeds the 10 MB limit`,
    }
  }

  // -- Step 1: Request presigned upload URL ---------------------------------
  let uploadUrl: string
  let r2Key: string
  try {
    const initRes = await fetchFn(webhookUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!initRes.ok) {
      const text = await initRes.text().catch(() => String(initRes.status))
      return { success: false, error: `Portal rejected request (${initRes.status}): ${text}` }
    }

    const payload = (await initRes.json()) as { uploadUrl?: unknown; r2Key?: unknown }
    if (typeof payload.uploadUrl !== 'string' || typeof payload.r2Key !== 'string') {
      return { success: false, error: 'Portal returned an unexpected response (missing uploadUrl or r2Key)' }
    }
    uploadUrl = payload.uploadUrl
    r2Key = payload.r2Key
  } catch (err) {
    return { success: false, error: `Network error during presign request: ${err instanceof Error ? err.message : String(err)}` }
  }

  // -- Step 2: Upload PDF directly to R2 via presigned URL ------------------
  try {
    const uploadRes = await fetchFn(uploadUrl, {
      method: 'PUT',
      body: pdfBlob,
      headers: { 'Content-Type': 'application/pdf' },
    })

    if (!uploadRes.ok) {
      return { success: false, error: `R2 upload failed (${uploadRes.status})` }
    }
  } catch (err) {
    return { success: false, error: `Network error during R2 upload: ${err instanceof Error ? err.message : String(err)}` }
  }

  // -- Step 3: Confirm upload so the portal persists the DB record ----------
  try {
    const confirmUrl = webhookUrl.endsWith('/') ? `${webhookUrl}confirm` : `${webhookUrl}/confirm`
    const confirmRes = await fetchFn(confirmUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...request, r2Key }),
    })

    if (!confirmRes.ok) {
      const text = await confirmRes.text().catch(() => String(confirmRes.status))
      return { success: false, error: `Portal confirmation failed (${confirmRes.status}): ${text}` }
    }
  } catch (err) {
    return { success: false, error: `Network error during confirmation: ${err instanceof Error ? err.message : String(err)}` }
  }

  return { success: true }
}

/** Returns true when the string looks like a valid UUID (v1-v5 or nil). */
export function isValidArtistId(value: string): boolean {
  return UUID_RE.test(value)
}

/** Returns true when the period string is in a supported format. */
export function isValidPeriod(value: string): boolean {
  return PERIOD_RE.test(value)
}
