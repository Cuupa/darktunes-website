/**
 * Short-lived signed cover-art verification tokens.
 * Lets submit-release skip re-downloading a just-verified image.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { normalizeCoverArtUrl } from '@/lib/submissions/coverArtUrl'

const TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes
const VERSION = 'v1'

export interface CoverArtTokenPayload {
  url: string
  width: number
  height: number
  format: string
  exp: number
}

function signPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url')
}

/**
 * Mint a token after a successful cover check.
 * `url` is stored normalized so submit compares apples-to-apples.
 */
export function mintCoverArtToken(
  secret: string,
  input: { url: string; width: number; height: number; format?: string },
  nowMs = Date.now(),
): string {
  const payload: CoverArtTokenPayload = {
    url: normalizeCoverArtUrl(input.url.trim()),
    width: input.width,
    height: input.height,
    format: input.format ?? 'jpeg',
    exp: nowMs + TOKEN_TTL_MS,
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = signPayload(secret, body)
  return `${VERSION}.${body}.${sig}`
}

export type CoverArtTokenVerifyResult =
  | { ok: true; payload: CoverArtTokenPayload }
  | { ok: false; reason: 'malformed' | 'bad_sig' | 'expired' | 'url_mismatch' }

/**
 * Verify token signature, expiry, and that it matches the submitted cover URL.
 */
export function verifyCoverArtToken(
  secret: string,
  token: string,
  coverUrl: string,
  nowMs = Date.now(),
): CoverArtTokenVerifyResult {
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== VERSION) {
    return { ok: false, reason: 'malformed' }
  }
  const [, body, sig] = parts
  if (!body || !sig) return { ok: false, reason: 'malformed' }

  const expected = signPayload(secret, body)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: 'bad_sig' }
    }
  } catch {
    return { ok: false, reason: 'bad_sig' }
  }

  let payload: CoverArtTokenPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CoverArtTokenPayload
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  if (typeof payload.exp !== 'number' || payload.exp < nowMs) {
    return { ok: false, reason: 'expired' }
  }

  const want = normalizeCoverArtUrl(coverUrl.trim())
  const got = normalizeCoverArtUrl(String(payload.url ?? '').trim())
  // Accept either raw or normalized match
  if (got !== want && payload.url !== coverUrl.trim()) {
    return { ok: false, reason: 'url_mismatch' }
  }

  return { ok: true, payload }
}
