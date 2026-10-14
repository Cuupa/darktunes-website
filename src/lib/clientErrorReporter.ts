'use client'

/**
 * src/lib/clientErrorReporter.ts
 *
 * Reports client-side errors to POST /api/log-error.
 * Prefers sendBeacon so a crash during navigation still lands. Best-effort,
 * never throws. Session is optional — the ingest is public and rate-limited.
 */

const endpoint = '/api/log-error'
const windowMs = 60_000
const maxPerWindow = 5

let windowStartedAt = 0
let sentInWindow = 0

/** True only for errors that came from this site. Skips extensions and ResizeObserver noise. */
export function shouldReportWindowError(
  event: { filename?: string; message?: string },
  origin: string,
): boolean {
  const message = event.message ?? ''
  if (message.includes('ResizeObserver loop')) return false
  if (!event.filename || !origin) return false
  return event.filename.startsWith(origin)
}

export function reportClientError(
  source: string,
  error: unknown,
  details?: Record<string, unknown>,
  level: 'error' | 'warn' | 'info' = 'error',
): void {
  if (typeof window === 'undefined') return

  const now = Date.now()
  if (now - windowStartedAt > windowMs) {
    windowStartedAt = now
    sentInWindow = 0
  }
  if (sentInWindow >= maxPerWindow) return
  sentInWindow += 1

  const message = error instanceof Error ? error.message : String(error)
  const body = JSON.stringify({
    source,
    message: message.slice(0, 2000),
    level,
    details: {
      ...details,
      stack: error instanceof Error ? error.stack?.slice(0, 8000) ?? null : null,
      path: window.location.pathname,
    },
  })

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon(endpoint, blob)) return
    }
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      credentials: 'include',
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Reporting must never affect the app
  }
}

/** Test-only — resets the client rate window. */
export function _resetClientErrorReporterForTests(): void {
  windowStartedAt = 0
  sentInWindow = 0
}
