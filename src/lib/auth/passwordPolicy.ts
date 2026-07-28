/**
 * Strong password policy — single source of truth for all set-password flows
 * (invite accept, recovery, portal/press settings, press apply, register).
 *
 * Rules (aligned with modern auth guidance):
 * - 12–128 characters
 * - At least one lowercase, uppercase, digit, and special character
 * - Not in a small common-password denylist
 */

import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

/** Characters accepted as "special" for the complexity rule. */
export const PASSWORD_SPECIAL_RE = /[^A-Za-z0-9]/

export type PasswordPolicyCode =
  | 'too_short'
  | 'too_long'
  | 'no_lower'
  | 'no_upper'
  | 'no_digit'
  | 'no_special'
  | 'common'
  | 'mismatch'

export interface PasswordPolicyFailure {
  ok: false
  code: PasswordPolicyCode
  /** English message suitable for server errors / logs. */
  message: string
}

export type PasswordPolicyResult = { ok: true } | PasswordPolicyFailure

/** Compact denylist of very common passwords (lowercase compare). */
const COMMON_PASSWORDS = new Set(
  [
    'password',
    'password123',
    'password1234',
    'password12345',
    '123456789012',
    '1234567890',
    'qwertyuiop',
    'qwerty123456',
    'iloveyou123',
    'admin123456',
    'welcome1234',
    'letmein1234',
    'changeme123',
    'darktunes123',
    'passw0rd1234',
    'abcdefghijkl',
    '1q2w3e4r5t6y',
  ].map((s) => s.toLowerCase()),
)

const POLICY_MESSAGES: Record<Exclude<PasswordPolicyCode, 'mismatch'>, string> = {
  too_short: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  too_long: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`,
  no_lower: 'Password must include at least one lowercase letter.',
  no_upper: 'Password must include at least one uppercase letter.',
  no_digit: 'Password must include at least one number.',
  no_special: 'Password must include at least one special character (e.g. !@#$%).',
  common: 'This password is too common. Choose a stronger one.',
}

/** Human-readable requirement lines for UI hints (English). */
export const PASSWORD_REQUIREMENT_LINES = [
  `At least ${PASSWORD_MIN_LENGTH} characters`,
  'One uppercase letter',
  'One lowercase letter',
  'One number',
  'One special character (!@#$%…)',
] as const

/** Stable ids for live checklist + i18n (`password_req_*` / `password_err_*`). */
export type PasswordRequirementId =
  | 'length'
  | 'upper'
  | 'lower'
  | 'digit'
  | 'special'

export interface PasswordRequirementCheck {
  id: PasswordRequirementId
  /** English fallback label. */
  label: string
  met: boolean
}

/**
 * Live checklist for UI: which rules the current password value already satisfies.
 * Empty password → all unmet (so the user sees the full requirements).
 */
export function getPasswordRequirementChecks(password: string): PasswordRequirementCheck[] {
  const value = typeof password === 'string' ? password : ''
  return [
    {
      id: 'length',
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      met: value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
    },
    {
      id: 'upper',
      label: 'One uppercase letter',
      met: /[A-Z]/.test(value),
    },
    {
      id: 'lower',
      label: 'One lowercase letter',
      met: /[a-z]/.test(value),
    },
    {
      id: 'digit',
      label: 'One number',
      met: /[0-9]/.test(value),
    },
    {
      id: 'special',
      label: 'One special character (!@#$%…)',
      met: PASSWORD_SPECIAL_RE.test(value),
    },
  ]
}

/** All failing rule codes for a password (for multi-hint error UI). */
export function getPasswordPolicyFailures(password: string): PasswordPolicyCode[] {
  const codes: PasswordPolicyCode[] = []
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    codes.push('too_short')
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    codes.push('too_long')
  }
  if (!/[a-z]/.test(password ?? '')) codes.push('no_lower')
  if (!/[A-Z]/.test(password ?? '')) codes.push('no_upper')
  if (!/[0-9]/.test(password ?? '')) codes.push('no_digit')
  if (!PASSWORD_SPECIAL_RE.test(password ?? '')) codes.push('no_special')
  if (password && COMMON_PASSWORDS.has(password.toLowerCase())) codes.push('common')
  return codes
}

export function validatePassword(password: string): PasswordPolicyResult {
  const failures = getPasswordPolicyFailures(password)
  if (failures.length === 0) return { ok: true }
  const code = failures[0]!
  return {
    ok: false,
    code,
    message: POLICY_MESSAGES[code as Exclude<PasswordPolicyCode, 'mismatch'>],
  }
}

/**
 * Map policy code → portal i18n key under namespace `portal`.
 * Use with `useTranslations('portal')`.
 */
export function passwordPolicyI18nKey(code: PasswordPolicyCode): string {
  switch (code) {
    case 'too_short':
      return 'password_err_too_short'
    case 'too_long':
      return 'password_err_too_long'
    case 'no_lower':
      return 'password_err_no_lower'
    case 'no_upper':
      return 'password_err_no_upper'
    case 'no_digit':
      return 'password_err_no_digit'
    case 'no_special':
      return 'password_err_no_special'
    case 'common':
      return 'password_err_common'
    case 'mismatch':
      return 'password_err_mismatch'
    default:
      return 'password_err_generic'
  }
}

export function passwordRequirementI18nKey(id: PasswordRequirementId): string {
  return `password_req_${id}`
}

/** Validate password + confirmation match. */
export function validatePasswordPair(
  password: string,
  confirmPassword: string,
): PasswordPolicyResult {
  const base = validatePassword(password)
  if (!base.ok) return base
  if (password !== confirmPassword) {
    return {
      ok: false,
      code: 'mismatch',
      message: 'Passwords do not match.',
    }
  }
  return { ok: true }
}

/**
 * Zod schema for a single strong password field.
 * Use on server actions and API bodies.
 */
export const strongPasswordSchema = z
  .string()
  .superRefine((value, ctx) => {
    const result = validatePassword(value)
    if (!result.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message })
    }
  })

/**
 * Pair schema for new + confirm password.
 */
export const strongPasswordPairSchema = z
  .object({
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    const result = validatePasswordPair(data.newPassword, data.confirmPassword)
    if (!result.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.message,
        path: result.code === 'mismatch' ? ['confirmPassword'] : ['newPassword'],
      })
    }
  })
