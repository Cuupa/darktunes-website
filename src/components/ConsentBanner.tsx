'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const STORAGE_KEY = 'darktunes_consent_external'

export type ConsentState = 'accepted' | 'rejected' | null

/**
 * Reads the persisted consent state from localStorage.
 * Returns null when no decision has been made yet (or during SSR).
 */
export function getConsentState(): ConsentState {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'accepted' || stored === 'rejected') return stored
  return null
}

/**
 * Saves the consent decision to localStorage.
 */
export function setConsentState(state: 'accepted' | 'rejected'): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, state)
  window.dispatchEvent(new Event('darktunes_consent_change'))
}

/**
 * GDPR-compliant consent banner for external media embeds.
 *
 * Shown at the bottom of the page until the user makes a decision.
 * The decision is persisted in localStorage. Spotify players and YouTube
 * iframes will not load until the user accepts.
 *
 * Note: This implements opt-in consent for external services (DSGVO Art. 6).
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Show banner only if no prior decision was made
    if (getConsentState() === null) {
      setVisible(true)
    }
  }, [])

  const handleAccept = () => {
    setConsentState('accepted')
    setVisible(false)
  }

  const handleReject = () => {
    setConsentState('rejected')
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4 lg:p-6"
          role="dialog"
          aria-label="Cookie-Einwilligung"
          aria-modal="false"
        >
          <div className="container mx-auto max-w-4xl">
            <div className="bg-card border border-border rounded-xl shadow-2xl p-6 flex flex-col md:flex-row gap-4 items-start md:items-center backdrop-blur-sm">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground mb-1">
                  Externe Inhalte & Datenschutz
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Diese Website möchte Inhalte externer Anbieter (Spotify, YouTube) einbetten.
                  Durch Klick auf &quot;Akzeptieren&quot; stimmen Sie der Übermittlung von Daten an
                  diese Drittanbieter zu (DSGVO Art. 6 Abs. 1 lit. a).{' '}
                  <Link href="/datenschutz" className="underline hover:text-accent transition-colors">
                    Datenschutzerklärung
                  </Link>
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReject}
                  className="text-xs border-border hover:border-foreground/50"
                >
                  Ablehnen
                </Button>
                <Button
                  size="sm"
                  onClick={handleAccept}
                  className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  Akzeptieren
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
