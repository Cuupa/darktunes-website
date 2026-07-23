/**
 * Server-side cover art verification (JPEG 3000×3000).
 * Bypasses browser CORS; handles Google Drive share links.
 */

import sharp from 'sharp'
import {
  extractGoogleDriveFileId,
  isAllowedCoverArtUrl,
  isJpegMagicBytes,
  isPrivateOrLoopbackHost,
  isValidCoverArtSize,
  normalizeCoverArtUrl,
} from '@/lib/submissions/coverArtUrl'

export type CoverArtCheckStatus =
  | 'ok'
  | 'invalid_url'
  | 'forbidden_host'
  | 'fetch_failed'
  | 'not_image'
  | 'wrong_format'
  | 'wrong_size'
  | 'too_large'

export interface CoverArtCheckResult {
  status: CoverArtCheckStatus
  verified: boolean
  width?: number
  height?: number
  format?: string
  message?: string
}

const MAX_BYTES = 20 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 5

export async function verifyCoverArtUrl(
  rawUrl: string,
  options?: {
    r2PublicUrl?: string
    fetchFn?: typeof fetch
  },
): Promise<CoverArtCheckResult> {
  const fetchFn = options?.fetchFn ?? fetch
  const r2PublicUrl = options?.r2PublicUrl
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return { status: 'invalid_url', verified: false, message: 'Missing cover art URL' }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { status: 'invalid_url', verified: false, message: 'Invalid cover art URL' }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { status: 'invalid_url', verified: false, message: 'Cover art URL must be http(s)' }
  }

  const candidates = buildFetchCandidates(trimmed, r2PublicUrl)
  if (candidates.length === 0) {
    return {
      status: 'forbidden_host',
      verified: false,
      message: 'Cover art host is not allowed',
    }
  }

  let lastError: CoverArtCheckStatus = 'fetch_failed'
  let lastMessage: string | undefined
  for (const candidate of candidates) {
    try {
      const result = await fetchAndInspect(candidate, fetchFn, r2PublicUrl)
      if (result.verified) return result
      // Prefer informative failures over generic fetch_failed
      if (result.status !== 'fetch_failed') return result
      lastError = result.status
      lastMessage = result.message
    } catch {
      lastError = 'fetch_failed'
    }
  }

  return {
    status: lastError,
    verified: false,
    message:
      lastMessage ??
      (lastError === 'fetch_failed'
        ? 'Could not download cover art. For Google Drive, share the file as “Anyone with the link”.'
        : undefined),
  }
}

function buildFetchCandidates(raw: string, r2PublicUrl?: string): string[] {
  const normalized = normalizeCoverArtUrl(raw)
  const out: string[] = []
  const push = (u: string) => {
    if (!out.includes(u) && isAllowedCoverArtUrl(u, r2PublicUrl)) out.push(u)
  }

  push(normalized)
  push(raw)

  // Drive often serves images more reliably via googleusercontent
  const driveId = extractGoogleDriveFileId(raw) ?? extractGoogleDriveFileId(normalized)
  if (driveId) {
    push(`https://drive.google.com/uc?export=download&id=${driveId}`)
    push(`https://lh3.googleusercontent.com/d/${driveId}`)
    push(`https://drive.google.com/thumbnail?id=${driveId}&sz=w3000`)
  }

  return out
}

async function fetchAndInspect(
  url: string,
  fetchFn: typeof fetch,
  r2PublicUrl?: string,
): Promise<CoverArtCheckResult> {
  const response = await fetchWithRedirectGuard(url, fetchFn, r2PublicUrl)
  if (!response.ok) {
    return {
      status: 'fetch_failed',
      verified: false,
      message: `Upstream returned HTTP ${response.status}`,
    }
  }

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
  if (contentType.includes('text/html')) {
    return {
      status: 'not_image',
      verified: false,
      message:
        'URL returned HTML instead of an image. For Google Drive, set sharing to “Anyone with the link”.',
    }
  }

  const contentLength = Number(response.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BYTES) {
    return { status: 'too_large', verified: false, message: 'Cover art file is too large (max 20 MB)' }
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > MAX_BYTES) {
    return { status: 'too_large', verified: false, message: 'Cover art file is too large (max 20 MB)' }
  }
  if (buffer.byteLength < 3) {
    return { status: 'not_image', verified: false, message: 'Empty or invalid image response' }
  }

  // Drive virus-scan pages sometimes claim octet-stream
  const head = buffer.subarray(0, Math.min(64, buffer.byteLength)).toString('utf8').toLowerCase()
  if (head.includes('<!doctype') || head.includes('<html') || head.includes('confirm')) {
    if (!isJpegMagicBytes(new Uint8Array(buffer.subarray(0, 3)))) {
      return {
        status: 'not_image',
        verified: false,
        message:
          'URL returned HTML instead of an image. For Google Drive, set sharing to “Anyone with the link”.',
      }
    }
  }

  const bytes = new Uint8Array(buffer)
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>
  try {
    meta = await sharp(buffer).metadata()
  } catch {
    if (!isJpegMagicBytes(bytes)) {
      return {
        status: 'wrong_format',
        verified: false,
        message: 'Cover art must be JPEG/JPG',
      }
    }
    return { status: 'not_image', verified: false, message: 'Could not read image dimensions' }
  }

  const width = meta.width
  const height = meta.height
  const format = meta.format

  if (!width || !height) {
    return { status: 'not_image', verified: false, message: 'Could not read image dimensions' }
  }

  if (format !== 'jpeg' && !isJpegMagicBytes(bytes)) {
    return {
      status: 'wrong_format',
      verified: false,
      format,
      width,
      height,
      message: 'Cover art must be JPEG/JPG',
    }
  }

  if (!isValidCoverArtSize(width, height)) {
    return {
      status: 'wrong_size',
      verified: false,
      width,
      height,
      format,
      message: `Expected 3000×3000 px, got ${width}×${height} px`,
    }
  }

  if (format && format !== 'jpeg') {
    return {
      status: 'wrong_format',
      verified: false,
      width,
      height,
      format,
      message: 'Cover art must be JPEG/JPG',
    }
  }

  return {
    status: 'ok',
    verified: true,
    width,
    height,
    format: format ?? 'jpeg',
  }
}

/**
 * Follow redirects manually so each hop stays on the SSRF allowlist.
 */
async function fetchWithRedirectGuard(
  startUrl: string,
  fetchFn: typeof fetch,
  r2PublicUrl?: string,
): Promise<Response> {
  let current = startUrl
  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    if (!isAllowedCoverArtUrl(current, r2PublicUrl)) {
      throw new Error('Redirect target host is not allowed')
    }
    try {
      const host = new URL(current).hostname
      if (isPrivateOrLoopbackHost(host)) {
        throw new Error('Redirect target is private')
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Redirect')) throw err
      throw new Error('Invalid redirect URL')
    }

    const response = await fetchFn(current, {
      redirect: 'manual',
      headers: {
        Accept: 'image/jpeg,image/*,*/*;q=0.8',
        'User-Agent': 'darkTunes-cover-art-check/1.0',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) {
        return response
      }
      current = new URL(location, current).href
      continue
    }

    return response
  }

  throw new Error('Too many redirects')
}
