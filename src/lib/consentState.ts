/**
 * src/lib/consentState.ts — Consent state helpers
 *
 * Extracted from ConsentBanner.tsx so the component file contains only React
 * components. This satisfies the react-refresh/only-export-components rule
 * and keeps consent state logic reusable.
 *
 * Persistence uses a first-party cookie (`darktunes_consent`) so the
 * decision survives page reloads in all privacy contexts, and can eventually
 * be read server-side to eliminate the SSR flash.
 *
 * Backwards-compatibility: if the cookie is absent we check the old
 * `darktunes_consent_external` localStorage key and migrate the value to the
 * cookie on first read.
 */

const COOKIE_NAME = 'darktunes_consent'
const LEGACY_STORAGE_KEY = 'darktunes_consent_external'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year in seconds

export type ConsentState = 'accepted' | 'rejected' | null

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readCookie(): ConsentState {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_NAME}=`))
  const value = match?.split('=')[1]
  if (value === 'accepted' || value === 'rejected') return value
  return null
}

function writeCookie(state: 'accepted' | 'rejected'): void {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NAME}=${state}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

function migrateLegacyStorage(): ConsentState {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (stored === 'accepted' || stored === 'rejected') {
      // Migrate to cookie and clean up localStorage
      writeCookie(stored)
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
      return stored
    }
  } catch {
    // localStorage may be inaccessible in strict privacy modes — ignore
  }
  return null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reads the persisted consent state from the cookie.
 * Falls back to the legacy localStorage key and migrates it on first read.
 * Returns null when no decision has been made yet (or during SSR).
 */
export function getConsentState(): ConsentState {
  if (typeof document === 'undefined') return null
  const cookieValue = readCookie()
  if (cookieValue !== null) return cookieValue
  // No cookie — try migrating from localStorage
  return migrateLegacyStorage()
}

/**
 * Saves the consent decision to a persistent cookie and dispatches a custom
 * event so all ConsentGate instances on the page react immediately.
 */
export function setConsentState(state: 'accepted' | 'rejected'): void {
  if (typeof document === 'undefined') return
  writeCookie(state)
  window.dispatchEvent(new Event('darktunes_consent_change'))
}
