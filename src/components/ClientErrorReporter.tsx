'use client'

import { useEffect } from 'react'
import { reportClientError, shouldReportWindowError } from '@/lib/clientErrorReporter'

/**
 * Global browser errors (uncaught exceptions and unhandled promise rejections)
 * reported to POST /api/log-error. Side-effect only; rate limit lives in
 * `clientErrorReporter`.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      if (!shouldReportWindowError(event, window.location.origin)) return
      reportClientError('ui', event.error ?? event.message, {
        boundary: 'window.onerror',
        path: window.location.pathname,
      })
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason
      reportClientError(
        'ui',
        reason instanceof Error ? reason : String(reason ?? 'Unhandled promise rejection'),
        {
          boundary: 'unhandledrejection',
          path: window.location.pathname,
        },
      )
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return null
}
