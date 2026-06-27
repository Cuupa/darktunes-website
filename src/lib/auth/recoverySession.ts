/**
 * Password recovery must target the account that received the email,
 * not whichever session happens to be active in the browser.
 */

export type RecoveryAuthChangeEvent =
  | 'INITIAL_SESSION'
  | 'PASSWORD_RECOVERY'
  | 'SIGNED_IN'
  | string

/** Whether an auth event should unlock the recovery password form. */
export function isRecoverySessionEvent(
  event: RecoveryAuthChangeEvent,
  options: { codeExchangeSucceeded: boolean; trustInitialSession?: boolean },
): boolean {
  if (event === 'PASSWORD_RECOVERY') return true
  if (options.codeExchangeSucceeded && event === 'SIGNED_IN') return true
  if (options.trustInitialSession && event === 'INITIAL_SESSION') return true
  return false
}