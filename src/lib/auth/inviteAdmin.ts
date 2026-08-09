/**
 * Shared helpers for admin invite / resend API routes.
 */

import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, buildApiError } from '@/lib/errors'
import { getClientIp } from '@/lib/ipRateLimit'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'
import type { RequestUserInviteResult } from '@/lib/auth/requestUserInvite'
import { INVITABLE_ROLES, type InvitableRole } from '@/types/users'

/** Max invite/resend actions per admin per window. */
export const ADMIN_INVITE_RATE_MAX = 20
export const ADMIN_INVITE_RATE_WINDOW_MS = 10 * 60_000

/** Max durable-token exchange attempts per IP. */
export const PUBLIC_INVITE_EXCHANGE_RATE_MAX = 30
export const PUBLIC_INVITE_EXCHANGE_RATE_WINDOW_MS = 15 * 60_000

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const inviteEmailSchema = z
  .string()
  .trim()
  .email('Invalid email address')
  .max(254)
  .transform((v) => v.toLowerCase())

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export function assertUuid(value: string, label = 'id'): string {
  if (!isUuid(value)) throw new ApiError(400, `Invalid ${label}`)
  return value
}

export function parseInvitableRole(raw: string): InvitableRole {
  if (!INVITABLE_ROLES.includes(raw as InvitableRole)) {
    throw new ApiError(400, 'Invalid role — must be admin, artist, editor, or journalist')
  }
  return raw as InvitableRole
}

export async function enforceAdminInviteRateLimit(
  req: NextRequest,
  adminUserId: string,
): Promise<void> {
  const ip = getClientIp(req)
  const rl = await checkDistributedRateLimit(
    `admin-invite:${adminUserId}:${ip}`,
    ADMIN_INVITE_RATE_MAX,
    ADMIN_INVITE_RATE_WINDOW_MS,
  )
  if (rl.limited) {
    throw new ApiError(429, 'Too many invite requests. Please try again later.')
  }
}

export async function enforcePublicInviteExchangeRateLimit(req: NextRequest): Promise<boolean> {
  const ip = getClientIp(req)
  const rl = await checkDistributedRateLimit(
    `invite-exchange:${ip}`,
    PUBLIC_INVITE_EXCHANGE_RATE_MAX,
    PUBLIC_INVITE_EXCHANGE_RATE_WINDOW_MS,
  )
  return !rl.limited
}

/** Map invite/resend domain result to HTTP errors. */
export function throwIfInviteFailed(
  result: RequestUserInviteResult,
  options?: { emailForConflict?: string },
): asserts result is RequestUserInviteResult & { sent: true } {
  if (result.alreadyRegistered) {
    const email = options?.emailForConflict
    throw new ApiError(
      409,
      result.error ??
        (email
          ? `A user with email "${email}" already exists or has already signed in.`
          : 'User has already signed in or is already registered.'),
    )
  }
  if (!result.sent) {
    if (result.error?.toLowerCase().includes('resend is not configured')) {
      throw new ApiError(503, result.error)
    }
    if (
      result.error === 'User not found' ||
      result.error === 'User has no email address' ||
      result.error === 'Artist not found'
    ) {
      throw new ApiError(404, result.error)
    }
    throw buildApiError('EMAIL_SEND_FAILED', 500)
  }
}
