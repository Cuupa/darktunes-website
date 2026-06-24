/**
 * Client-side helpers for consent-gated page event tracking.
 */

import { getConsentState } from '@/lib/consentState'
import type { PageEventType } from '@/lib/api/pageEvents'

const SESSION_KEY = 'darktunes_pe_session'
const EXCLUDED_PREFIXES = ['/admin', '/portal', '/press', '/editor', '/login']

export function getOrCreatePageSessionId(): string {
  if (typeof sessionStorage === 'undefined') return ''
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

function shouldTrackPath(pathname: string): boolean {
  return !EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export interface TrackPageEventOptions {
  eventType: PageEventType
  path: string
  artistId?: string
}

export function trackPageEvent({ eventType, path, artistId }: TrackPageEventOptions): void {
  if (typeof window === 'undefined') return
  if (getConsentState() !== 'accepted') return
  if (!shouldTrackPath(path)) return

  const referrerHost = document.referrer
    ? (() => {
        try {
          return new URL(document.referrer).host
        } catch {
          return null
        }
      })()
    : null

  const body = JSON.stringify({
    eventType,
    path,
    artistId: artistId ?? null,
    sessionId: getOrCreatePageSessionId(),
    referrerHost,
  })

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' })
    navigator.sendBeacon('/api/page-events', blob)
    return
  }

  void fetch('/api/page-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Non-fatal — analytics must never break navigation
  })
}

export function trackShopClick(artistId: string, path: string): void {
  trackPageEvent({ eventType: 'shop_click', path, artistId })
}

export function trackSmartLinkClick(artistId: string, path: string): void {
  trackPageEvent({ eventType: 'smart_link_click', path, artistId })
}