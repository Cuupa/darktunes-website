'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { getConsentState, setConsentState } from '@/lib/consentState'
import type { Dictionary } from '@/i18n/types'

interface ConsentBannerProps {
  dict: Dictionary['consent']
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
export function ConsentBanner({ dict }: ConsentBannerProps) {
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
          aria-label={dict.bannerAriaLabel}
          aria-modal="false"
        >
          <div className="container mx-auto max-w-4xl">
            <div className="bg-card border border-border rounded-xl shadow-2xl p-6 flex flex-col md:flex-row gap-4 items-start md:items-center backdrop-blur-sm">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground mb-1">
                  {dict.bannerTitle}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {dict.bannerText}{' '}
                  <Link href="/datenschutz" className="underline hover:text-accent transition-colors">
                    {dict.privacyLink}
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
                  {dict.reject}
                </Button>
                <Button
                  size="sm"
                  onClick={handleAccept}
                  className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  {dict.accept}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
