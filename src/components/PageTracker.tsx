'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { getConsentState } from '@/lib/consentState'
import { trackPageEvent } from '@/lib/analytics/trackPageEvent'
import type { PageEventType } from '@/lib/api/pageEvents'

function resolveEventType(pathname: string): PageEventType {
  if (pathname.startsWith('/news/')) return 'news_view'
  return 'page_view'
}

/**
 * Fires a single page_view / news_view event per navigation when analytics
 * consent is accepted. Skips admin, portal, press, and editor routes.
 */
export function PageTracker() {
  const pathname = usePathname()
  const lastTrackedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || getConsentState() !== 'accepted') return
    if (lastTrackedRef.current === pathname) return
    lastTrackedRef.current = pathname

    trackPageEvent({
      eventType: resolveEventType(pathname),
      path: pathname,
    })
  }, [pathname])

  useEffect(() => {
    const onConsentChange = () => {
      if (getConsentState() === 'accepted' && pathname) {
        lastTrackedRef.current = null
        trackPageEvent({
          eventType: resolveEventType(pathname),
          path: pathname,
        })
      }
    }

    window.addEventListener('darktunes_consent_change', onConsentChange)
    return () => window.removeEventListener('darktunes_consent_change', onConsentChange)
  }, [pathname])

  return null
}