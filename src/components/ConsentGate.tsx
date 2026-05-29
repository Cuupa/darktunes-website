'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { getConsentState, setConsentState, type ConsentState } from '@/lib/consentState'

interface ConsentGateProps {
  /** The embed to render after consent is given. */
  children: ReactNode
  /** Label shown on the opt-in button (e.g. "Load Spotify" / "Spotify laden"). */
  label?: string
  /** Optional placeholder image URL (from R2). Falls back to a styled gradient div. */
  placeholderUrl?: string
  /** Alt text for the placeholder image. */
  placeholderAlt?: string
  /** Text shown above the opt-in button explaining data transfer. */
  gateText?: string
}

/**
 * ConsentGate — GDPR-compliant wrapper for external embeds.
 *
 * Blocks the embed until the user has accepted external media consent.
 * Shows a placeholder image (from Cloudflare R2 if provided) with an
 * opt-in button. Reacts immediately to ConsentBanner decisions via a
 * custom DOM event.
 */
export function ConsentGate({
  children,
  label = 'Load external content',
  placeholderUrl,
  placeholderAlt = 'External content — click to load',
  gateText = 'This content is provided by an external provider. By loading it, you agree to the transfer of data.',
}: ConsentGateProps) {
  const [consent, setConsent] = useState<ConsentState>(null)

  useEffect(() => {
    // Hydrate from localStorage
    setConsent(getConsentState())

    // React to consent changes triggered by ConsentBanner
    const handler = () => setConsent(getConsentState())
    window.addEventListener('darktunes_consent_change', handler)
    return () => window.removeEventListener('darktunes_consent_change', handler)
  }, [])

  const handleAccept = () => {
    setConsentState('accepted')
    setConsent('accepted')
  }

  if (consent === 'accepted') {
    return <>{children}</>
  }

  return (
    <div className="relative w-full rounded-md overflow-hidden bg-muted aspect-video flex items-center justify-center">
      {/* Placeholder — R2 image if configured, else brand gradient */}
      {placeholderUrl ? (
        <Image
          src={placeholderUrl}
          alt={placeholderAlt}
          fill
          className="object-cover opacity-40"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20" />
      )}

      <div className="relative z-10 text-center px-4 py-6 space-y-3">
        <p className="text-sm text-foreground/80 max-w-xs mx-auto">
          {gateText}
        </p>
        <Button
          size="sm"
          onClick={handleAccept}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs"
        >
          {label}
        </Button>
      </div>
    </div>
  )
}
