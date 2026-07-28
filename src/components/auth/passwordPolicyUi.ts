/**
 * Client helpers for password policy toasts / messages with next-intl.
 */

import {
  getPasswordPolicyFailures,
  type PasswordPolicyCode,
  type PasswordPolicyResult,
  validatePasswordPair,
} from '@/lib/auth/passwordPolicy'

/** Portal i18n keys used by password policy UI (must exist in en/de portal.json). */
export type PasswordPolicyUiKey =
  | 'password_err_too_short'
  | 'password_err_too_long'
  | 'password_err_no_lower'
  | 'password_err_no_upper'
  | 'password_err_no_digit'
  | 'password_err_no_special'
  | 'password_err_common'
  | 'password_err_mismatch'
  | 'password_err_multiple'
  | 'password_err_generic'
  | 'password_req_length'
  | 'password_req_upper'
  | 'password_req_lower'
  | 'password_req_digit'
  | 'password_req_special'
  | 'password_policy_heading'

/**
 * next-intl `useTranslations('portal')` is compatible: it accepts a wider key union
 * that includes these keys (parameter contravariance).
 */
export type PasswordPolicyTranslate = (key: PasswordPolicyUiKey) => string

const CODE_TO_KEY: Record<PasswordPolicyCode, PasswordPolicyUiKey> = {
  too_short: 'password_err_too_short',
  too_long: 'password_err_too_long',
  no_lower: 'password_err_no_lower',
  no_upper: 'password_err_no_upper',
  no_digit: 'password_err_no_digit',
  no_special: 'password_err_no_special',
  common: 'password_err_common',
  mismatch: 'password_err_mismatch',
}

/** Resolve a single policy code to a user-facing string. */
export function translatePasswordPolicyCode(
  code: PasswordPolicyCode,
  t: PasswordPolicyTranslate,
): string {
  return t(CODE_TO_KEY[code] ?? 'password_err_generic')
}

/**
 * Validate pair and return a localized error message, or null if ok.
 * Lists all unmet complexity rules so the user knows exactly what is missing.
 */
export function getLocalizedPasswordPairError(
  password: string,
  confirmPassword: string,
  t: PasswordPolicyTranslate,
): string | null {
  const result: PasswordPolicyResult = validatePasswordPair(password, confirmPassword)
  if (result.ok) return null

  if (result.code === 'mismatch') {
    return translatePasswordPolicyCode('mismatch', t)
  }

  const failures = getPasswordPolicyFailures(password)
  if (failures.length === 0) {
    return translatePasswordPolicyCode(result.code, t)
  }

  const unique = [...new Set(failures)]
  if (unique.length === 1) {
    return translatePasswordPolicyCode(unique[0]!, t)
  }

  const heading = t('password_err_multiple')
  // Single-line separators work reliably in toast UIs (multi-line is often flattened).
  const details = unique.map((code) => translatePasswordPolicyCode(code, t)).join(' · ')
  return `${heading} ${details}`
}
