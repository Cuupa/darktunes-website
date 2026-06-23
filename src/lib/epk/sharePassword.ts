/**
 * src/lib/epk/sharePassword.ts
 *
 * Scrypt password hashing for EPK share links (matches portal profile pattern).
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export function hashSharePassword(plain: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(plain, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifySharePassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = scryptSync(plain, salt, 64).toString('hex')
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'))
  } catch {
    return false
  }
}