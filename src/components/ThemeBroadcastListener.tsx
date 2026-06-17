'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Listens for theme-updated BroadcastChannel messages posted by ColorThemeManager
 * after a successful save. When received, triggers a soft Next.js router.refresh()
 * so public-site CSS vars update within ~1 second without a full page reload.
 *
 * Admin tabs that triggered the save do NOT receive their own message
 * (BroadcastChannel sender exclusion is spec behaviour).
 */
export function ThemeBroadcastListener() {
  const router = useRouter()

  useEffect(() => {
    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel('theme-updates')
      channel.onmessage = (event: MessageEvent<{ type: string }>) => {
        if (event.data?.type === 'theme-updated') {
          router.refresh()
        }
      }
    } catch {
      // BroadcastChannel not supported (e.g. private Safari) — silently ignore
    }
    return () => {
      channel?.close()
    }
  }, [router])

  return null
}
