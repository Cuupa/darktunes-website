/**
 * Server-side cover art verification (JPEG 3000×3000).
 * Bypasses browser CORS; handles Google Drive share links.
 */

import sharp from 'sharp'
import {
  isAllowedCoverArtUrl,
  isJpegMagicBytes,
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

export async function verifyCoverArtUrl(
  rawUrl: string,
  options?: {
    r2PublicUrl?: string
    fetchFn?: typeof fetch
  },
): Promise<CoverArtCheckResult> {
  const fetchFn = options?.fetchFn ?? fetch
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

  const normalized = normalizeCoverArtUrl(trimmed)
  if (!isAllowedCoverArtUrl(normalized, options?.r2PublicUrl) && !isAllowedCoverArtUrl(trimmed, options?.r2PublicUrl)) {
    return {
      status: 'forbidden_host',
      verified: false,
      message: 'Cover art host is not allowed',
    }
  }

  // Prefer normalized Drive URL for fetch; fall back to original for non-Drive hosts.
  const candidates = normalized === trimmed ? [trimmed] : [normalized, trimmed]

  let lastError: CoverArtCheckStatus = 'fetch_failed'
  for (const candidate of candidates) {
    if (!isAllowedCoverArtUrl(candidate, options?.r2PublicUrl)) continue

    try {
      const result = await fetchAndInspect(candidate, fetchFn)
      if (result.verified || result.status !== 'fetch_failed') {
        return result
      }
      lastError = result.status
    } catch {
      lastError = 'fetch_failed'
    }
  }

  return {
    status: lastError,
    verified: false,
    message:
      lastError === 'fetch_failed'
        ? 'Could not download cover art. For Google Drive, share the file as “Anyone with the link”.'
        : undefined,
  }
}

async function fetchAndInspect(url: string, fetchFn: typeof fetch): Promise<CoverArtCheckResult> {
  const response = await fetchFn(url, {
    redirect: 'follow',
    headers: {
      Accept: 'image/jpeg,image/*,*/*;q=0.8',
      'User-Agent': 'darkTunes-cover-art-check/1.0',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  if (!response.ok) {
    return {
      status: 'fetch_failed',
      verified: false,
      message: `Upstream returned HTTP ${response.status}`,
    }
  }

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
  // Drive sometimes returns HTML virus-scan / login pages
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

  const bytes = new Uint8Array(buffer)
  if (!isJpegMagicBytes(bytes)) {
    // Confirm with sharp when magic bytes fail (rare progressive / odd encodings)
    try {
      const meta = await sharp(buffer).metadata()
      if (meta.format !== 'jpeg') {
        return {
          status: 'wrong_format',
          verified: false,
          format: meta.format,
          width: meta.width,
          height: meta.height,
          message: 'Cover art must be JPEG/JPG',
        }
      }
    } catch {
      return {
        status: 'wrong_format',
        verified: false,
        message: 'Cover art must be JPEG/JPG',
      }
    }
  }

  let width: number | undefined
  let height: number | undefined
  let format: string | undefined
  try {
    const meta = await sharp(buffer).metadata()
    width = meta.width
    height = meta.height
    format = meta.format
  } catch {
    return { status: 'not_image', verified: false, message: 'Could not read image dimensions' }
  }

  if (!width || !height) {
    return { status: 'not_image', verified: false, message: 'Could not read image dimensions' }
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
