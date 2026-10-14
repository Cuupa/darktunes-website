import { createHmac, timingSafeEqual } from 'node:crypto'

const TTL_MS = 10 * 60 * 1000

function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(`promo-nda-v1:${body}`).digest('base64url')
}

export function mintPromoNdaToken(
  secret: string,
  userId: string,
  r2Key: string,
  nowMs = Date.now(),
): string {
  const body = Buffer.from(
    JSON.stringify({ u: userId, k: r2Key, e: nowMs + TTL_MS }),
    'utf8',
  ).toString('base64url')
  return `${body}.${sign(secret, body)}`
}

export function verifyPromoNdaToken(
  secret: string,
  token: string,
  userId: string,
  r2Key: string,
  nowMs = Date.now(),
): boolean {
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return false
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(secret, body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      u?: unknown
      k?: unknown
      e?: unknown
    }
    return payload.u === userId && payload.k === r2Key && typeof payload.e === 'number' && payload.e >= nowMs
  } catch {
    return false
  }
}
