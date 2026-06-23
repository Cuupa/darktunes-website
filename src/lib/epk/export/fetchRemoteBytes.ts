/**
 * src/lib/epk/export/fetchRemoteBytes.ts
 *
 * SSRF-safe remote byte fetcher for EPK PDF export (images, fonts, rider PDFs).
 */

import { isAllowedEpkImageUrl } from '@/lib/epk/epkImageProxy'

export async function fetchRemoteBytes(
  url: string,
  r2PublicUrl?: string,
  timeoutMs = 15_000,
): Promise<Uint8Array | null> {
  if (!url || !isAllowedEpkImageUrl(url, r2PublicUrl)) return null

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) return null
    return new Uint8Array(await response.arrayBuffer())
  } catch {
    return null
  }
}