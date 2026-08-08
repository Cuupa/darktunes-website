/**
 * Message attachment validation (SSOT).
 * Does not upload — callers must use R2 + signed URLs; store only safe metadata.
 */

import {
  MESSAGE_ATTACHMENT_MAX_BYTES,
  MESSAGE_ATTACHMENT_MIME,
} from '@/lib/messaging/constants'

export function assertMessageAttachmentAllowed(opts: {
  mimeType: string
  sizeBytes: number
  filename?: string
}): void {
  const mime = opts.mimeType.toLowerCase().trim()
  if (!MESSAGE_ATTACHMENT_MIME.has(mime)) {
    throw new Error(`Unsupported attachment type: ${opts.mimeType}`)
  }
  if (opts.sizeBytes < 0 || opts.sizeBytes > MESSAGE_ATTACHMENT_MAX_BYTES) {
    const maxMb = Math.round(MESSAGE_ATTACHMENT_MAX_BYTES / (1024 * 1024))
    throw new Error(`Attachment too large (max ${maxMb} MB)`)
  }
  const name = opts.filename ?? ''
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new Error('Invalid attachment filename')
  }
}

/**
 * Prefer storing R2 object keys or same-origin proxy paths, not long-lived public URLs.
 * Allows https R2 public hostnames and relative/app paths.
 */
export function isAllowedAttachmentUrl(url: string, r2PublicUrl?: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/')) return true
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:') return false
    if (r2PublicUrl) {
      try {
        if (parsed.hostname === new URL(r2PublicUrl).hostname) return true
      } catch {
        // ignore
      }
    }
    // Cloudflare R2 public bucket hostnames
    if (parsed.hostname.endsWith('.r2.dev')) return true
    if (parsed.hostname.endsWith('.r2.cloudflarestorage.com')) return true
    return false
  } catch {
    return false
  }
}
