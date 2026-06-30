/**
 * Short-lived HMAC tokens for draft Fan Page previews.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const TOKEN_TTL_MS = 30 * 60 * 1000

interface FanPagePreviewPayload {
  artistId: string
  slug: string
  exp: number
  nonce: string
}

function getPreviewSecret(): string {
  return (
    process.env.FAN_PAGE_PREVIEW_SECRET ??
    process.env.CRON_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ''
  )
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

function encodePayload(payload: FanPagePreviewPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodePayload(encoded: string): FanPagePreviewPayload | null {
  try {
    const raw = Buffer.from(encoded, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw) as FanPagePreviewPayload
    if (
      typeof parsed.artistId !== 'string' ||
      typeof parsed.slug !== 'string' ||
      typeof parsed.exp !== 'number' ||
      typeof parsed.nonce !== 'string'
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function createFanPagePreviewToken(artistId: string, slug: string): string {
  const secret = getPreviewSecret()
  if (!secret) throw new Error('Fan page preview secret is not configured')

  const payload: FanPagePreviewPayload = {
    artistId,
    slug,
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: randomBytes(8).toString('base64url'),
  }

  const encoded = encodePayload(payload)
  const signature = signPayload(encoded, secret)
  return `${encoded}.${signature}`
}

export function verifyFanPagePreviewToken(
  token: string,
  expectedSlug: string,
): { artistId: string; slug: string } | null {
  const secret = getPreviewSecret()
  if (!secret) return null

  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null

  const expectedSig = signPayload(encoded, secret)
  const sigBuffer = Buffer.from(signature, 'utf8')
  const expectedBuffer = Buffer.from(expectedSig, 'utf8')
  if (sigBuffer.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null

  const payload = decodePayload(encoded)
  if (!payload) return null
  if (payload.exp < Date.now()) return null
  if (payload.slug !== expectedSlug) return null

  return { artistId: payload.artistId, slug: payload.slug }
}

export const FAN_PAGE_PREVIEW_TOKEN_TTL_MS = TOKEN_TTL_MS