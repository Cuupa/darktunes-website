/**
 * src/lib/epk/export/fetchRemoteBytes.ts
 *
 * SSRF-safe remote byte fetcher for EPK PDF export (images, fonts, rider PDFs).
 */

import { isAllowedEpkImageUrl } from '@/lib/epk/epkImageProxy'

const MAX_REMOTE_BYTES = 25 * 1024 * 1024

export async function fetchRemoteBytes(
  url: string,
  r2PublicUrl?: string,
  timeoutMs = 15_000,
  maxBytes = MAX_REMOTE_BYTES,
): Promise<Uint8Array | null> {
  if (!url || !isAllowedEpkImageUrl(url, r2PublicUrl)) return null

  try {
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return null
    const contentLength = Number(response.headers.get('content-length') ?? '0')
    if (contentLength > maxBytes || contentLength < 0) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > maxBytes) return null
    return bytes
  } catch {
    return null
  }
}