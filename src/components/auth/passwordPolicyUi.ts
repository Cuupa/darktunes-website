/**
 * Client helpers for password policy toasts / messages with next-intl.
 */

import {
  getPasswordPolicyFailures,
  passwordPolicyI18nKey,
  type PasswordPolicyCode,
  type PasswordPolicyResult,
  validatePasswordPair,
} from '@/lib/auth/passwordPolicy'

type Translate = (key: string) => string

/** Resolve a single policy code to a user-facing string. */
export function translatePasswordPolicyCode(code: PasswordPolicyCode, t: Translate): string {
  try {
    return t(passwordPolicyI18nKey(code))
  } catch {
    return code
  }
}

/**
 * Validate pair and return a localized error message, or null if ok.
 * Lists all unmet complexity rules so the user knows exactly what is missing.
 */
export function getLocalizedPasswordPairError(
  password: string,
  confirmPassword: string,
  t: Translate,
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

  // Prefer a multi-line style list of missing requirements (first failure + all missing).
  const unique = [...new Set(failures)]
  if (unique.length === 1) {
    return translatePasswordPolicyCode(unique[0]!, t)
  }

  const heading = t('password_err_multiple')
  // Single-line separators work reliably in toast UIs (multi-line is often flattened).
  const details = unique.map((code) => translatePasswordPolicyCode(code, t)).join(' · ')
  return `${heading} ${details}`
}
