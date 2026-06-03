import { NextRequest, NextResponse } from 'next/server'

type WebVitalMetric = {
  id: string
  name: 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB'
  value: number
  delta: number
  rating: 'good' | 'needs-improvement' | 'poor'
  navigationType: string
}

function isWebVitalMetric(value: unknown): value is WebVitalMetric {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const payload = value as Partial<WebVitalMetric>

  return (
    typeof payload.id === 'string' &&
    typeof payload.name === 'string' &&
    typeof payload.value === 'number' &&
    typeof payload.delta === 'number' &&
    typeof payload.rating === 'string' &&
    typeof payload.navigationType === 'string'
  )
}

export async function POST(request: NextRequest) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!isWebVitalMetric(body)) {
    return NextResponse.json({ error: 'Invalid metric payload' }, { status: 400 })
  }

  console.info('[WebVitals API]', JSON.stringify(body))

  return NextResponse.json({ ok: true })
}
