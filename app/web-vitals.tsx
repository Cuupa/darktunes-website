'use client'

import { useReportWebVitals } from 'next/web-vitals'

type WebVitalMetric = {
  id: string
  name: 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB'
  value: number
  delta: number
  rating: 'good' | 'needs-improvement' | 'poor'
  navigationType: string
}

const TRACKED_METRICS = new Set<WebVitalMetric['name']>(['LCP', 'FID', 'CLS', 'FCP', 'TTFB', 'INP'])

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (!TRACKED_METRICS.has(metric.name as WebVitalMetric['name'])) {
      return
    }

    const payload: WebVitalMetric = {
      id: metric.id,
      name: metric.name as WebVitalMetric['name'],
      value: metric.value,
      delta: metric.delta,
      rating: metric.rating,
      navigationType: metric.navigationType,
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
