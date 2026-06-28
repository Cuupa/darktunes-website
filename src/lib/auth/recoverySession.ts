/**
 * Password recovery must target the account that received the email,
 * not whichever session happens to be active in the browser.
 */

export type RecoveryAuthChangeEvent =
  | 'INITIAL_SESSION'
  | 'PASSWORD_RECOVERY'
  | 'SIGNED_IN'
  | string

type AmrEntry = { method: string; timestamp: number }

type JwtPayload = {
  amr?: AmrEntry[]
}

function decodeJwtPayload(accessToken: string): JwtPayload | null {
  const segment = accessToken.split('.')[1]
  if (!segment) return null

  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json =
      typeof globalThis.atob === 'function'
        ? globalThis.atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8')
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

/** True when the access token was issued from a password-recovery link. */
export function sessionHasRecoveryAmr(accessToken: string | undefined): boolean {
  if (!accessToken) return false
  const payload = decodeJwtPayload(accessToken)
  return payload?.amr?.some((entry) => entry.method === 'recovery') ?? false
}

export interface PasswordSetupSessionOptions {
  serverExchangeSucceeded: boolean
  /** Invite links sign the user in via SIGNED_IN (not PASSWORD_RECOVERY). */
  allowInviteSignIn?: boolean
}

/** Whether an auth event should unlock the recovery password form. */
export function isRecoverySessionEvent(
  event: RecoveryAuthChangeEvent,
  options: PasswordSetupSessionOptions,
): boolean {
  if (event === 'PASSWORD_RECOVERY') return true
  if (options.serverExchangeSucceeded && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
    return true
  }
  if (
    options.allowInviteSignIn &&
    (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')
  ) {
    return true
  }
  return false
}

/**
 * Whether the session may be used to set a new password.
 * After /auth/callback sets exchanged=1 the server already validated the recovery link.
 */
export function canUseRecoverySession(
  accessToken: string | undefined,
  options: PasswordSetupSessionOptions,
): boolean {
  if (options.serverExchangeSucceeded) return Boolean(accessToken)
  if (options.allowInviteSignIn && accessToken) return true
  return sessionHasRecoveryAmr(accessToken)
}