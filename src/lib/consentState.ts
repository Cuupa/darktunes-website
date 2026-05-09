/**
 * src/lib/consentState.ts — Consent state helpers
 *
 * Extracted from ConsentBanner.tsx so the component file contains only React
 * components. This satisfies the react-refresh/only-export-components rule
 * and keeps consent state logic reusable.
 */

const STORAGE_KEY = 'darktunes_consent_external'

export type ConsentState = 'accepted' | 'rejected' | null

/**
 * Reads the persisted consent state from localStorage.
 * Returns null when no decision has been made yet (or during SSR).
 */
export function getConsentState(): ConsentState {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'accepted' || stored === 'rejected') return stored
  return null
}

/**
 * Saves the consent decision to localStorage and dispatches a custom event
 * so all ConsentGate instances on the page react immediately.
 */
export function setConsentState(state: 'accepted' | 'rejected'): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, state)
  window.dispatchEvent(new Event('darktunes_consent_change'))
}
