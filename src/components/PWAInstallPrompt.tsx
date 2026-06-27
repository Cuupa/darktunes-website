'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X, DeviceMobile, ArrowSquareOut } from '@phosphor-icons/react'

/**
 * PWAInstallPrompt — custom in-app install banner.
 *
 * Listens for the browser's `beforeinstallprompt` event and defers it.
 * When the user clicks "Install", we trigger the native install dialogue.
 * The banner is dismissed on explicit close or after a successful install.
 *
 * Rules:
 * - Only shown on devices that support PWA installation (Chrome/Edge on
 *   Android; Samsung Internet). iOS uses the manual Share → Add to Home
 *   Screen flow and does not fire `beforeinstallprompt`.
 * - Dismissed state is persisted in localStorage so we never annoy users
 *   who already said no.
 * - Fully keyboard-accessible with visible focus rings.
 * - Respects `prefers-reduced-motion`.
 */

// Minimal typing for the deferred prompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'pwa-install-dismissed'

export function PWAInstallPrompt() {
  const prefersReducedMotion = useReducedMotion()

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Never show if the user already dismissed the banner
    if (typeof window !== 'undefined' && localStorage.getItem(DISMISSED_KEY)) return

    // Detect iOS for the manual instruction variant
    const ios =
      typeof navigator !== 'undefined' &&
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      // Only show on Safari (not already installed)
      !window.matchMedia('(display-mode: standalone)').matches

    if (ios) {
      // Delay slightly so the page has fully loaded
      const t = setTimeout(() => setIsIOS(true), 3000)
      return () => clearTimeout(t)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Show the Android/Chrome banner once we have a deferred prompt
  useEffect(() => {
    if (deferredPrompt) {
      const t = setTimeout(() => setShowBanner(true), 3000)
      return () => clearTimeout(t)
    }
  }, [deferredPrompt])

  // Show the iOS hint as a separate flag
  useEffect(() => {
    if (isIOS) setShowBanner(true)
  }, [isIOS])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowBanner(false)
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShowBanner(false)
    setDeferredPrompt(null)
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  const visible = showBanner && (!!deferredPrompt || isIOS)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="dialog"
          aria-modal="false"
          aria-label="Install darkTunes as an app"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 80 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 80 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeOut' }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[9999] flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-2xl shadow-black/60 backdrop-blur-sm"
        >
          {/* App icon placeholder */}
          <div
            className="flex-none w-12 h-12 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center"
            aria-hidden="true"
          >
            <DeviceMobile size={24} weight="fill" className="text-accent" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground leading-tight">
              darkTunes als App installieren
            </p>
            {isIOS ? (
              <p className="mt-1 text-xs text-muted-foreground leading-snug">
                Tippe auf{' '}
                <ArrowSquareOut
                  size={12}
                  weight="bold"
                  className="inline align-middle"
                  aria-hidden="true"
                />{' '}
                und dann &ldquo;Zum Home-Bildschirm&rdquo;.
              </p>
            ) : (
              <>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Schneller Zugriff · Tourplaner offline nutzbar
                </p>
                <button
                  onClick={handleInstall}
                  className="mt-2 px-4 py-1.5 rounded-full bg-accent text-white text-xs font-mono uppercase tracking-widest hover:bg-accent/80 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Installieren
                </button>
              </>
            )}
          </div>

          {/* Close / dismiss */}
          <button
            onClick={handleDismiss}
            aria-label="Install-Banner schließen"
            className="flex-none p-1 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X size={16} weight="bold" aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
