/**
 * Client-side helper to persist operational warnings/errors to app_logs via /api/log-error.
 */

export type ClientAppLogLevel = 'error' | 'warn' | 'info'

export async function logClientAppEvent(
  source: string,
  message: string,
  level: ClientAppLogLevel = 'error',
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const res = await fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, level, message, details }),
    })
    if (!res.ok) {
      console.warn(`[logClientAppEvent] /api/log-error returned ${res.status} for ${source}`)
    }
  } catch {
    // Never throw from logging
  }
}