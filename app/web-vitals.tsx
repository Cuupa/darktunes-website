'use client'

import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'

type ConnectionType = '4g' | '3g' | '2g' | 'slow-2g' | 'unknown'

// Extend Navigator with the optional Network Information API
interface NavigatorWithConnection extends Navigator {
  connection?: { effectiveType?: ConnectionType }
}

type WebVitalMetric = {
  id: string
  name: 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB'
  value: number
  delta: number
  rating: 'good' | 'needs-improvement' | 'poor'
  navigationType: string
  /** Current route pathname (populated at report time) */
  pathname: string
  /** Effective network connection type (optional, browser-dependent) */
  connectionType: ConnectionType
}

const TRACKED_METRICS = new Set<WebVitalMetric['name']>(['LCP', 'FID', 'CLS', 'FCP', 'TTFB', 'INP'])

export function WebVitals() {
  const pathname = usePathname()

  useReportWebVitals((metric) => {
    if (!TRACKED_METRICS.has(metric.name as WebVitalMetric['name'])) {
      return
    }

    const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithConnection) : undefined
    const connectionType: ConnectionType = nav?.connection?.effectiveType ?? 'unknown'

    const payload: WebVitalMetric = {
      id: metric.id,
      name: metric.name as WebVitalMetric['name'],
      value: metric.value,
      delta: metric.delta,
      rating: metric.rating,
      navigationType: metric.navigationType,
      pathname: pathname ?? '/',
      connectionType,
    }

    if (process.env.NODE_ENV === 'development') {
      console.info('[Web Vitals]', payload)
    }

    void fetch('/api/vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
  })

  return null
}
