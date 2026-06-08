'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ShieldCheck } from '@phosphor-icons/react'
import { getConsentState, setConsentState, type ConsentState } from '@/lib/consentState'

interface ConsentGateProps {
  /** The embed to render after consent is given. */
  children: ReactNode
  /** Short label shown on the opt-in button (e.g. "Load Spotify Player"). */
  label?: string
  /** Optional title shown above the description text (e.g. "Listen on Spotify"). */
  title?: string
  /** Optional icon element rendered next to the title. */
  providerIcon?: ReactNode
  /** Optional placeholder image URL (from R2). Falls back to a styled gradient div. */
  placeholderUrl?: string
  /** Alt text for the placeholder image. */
  placeholderAlt?: string
  /** Text explaining the data transfer shown before consent is given. */
  gateText?: string
  /** Optional URL for the privacy policy link shown in the gate. */
  privacyPolicyUrl?: string
  /** Link text for the privacy policy link. */
  privacyPolicyLabel?: string
  /**
   * Optional server-read initial consent value.
   * Pass the value of the `darktunes_consent` cookie read server-side to
   * render the embed immediately on first paint (eliminates SSR flash).
   */
  initialConsent?: ConsentState
}

/**
 * ConsentGate — GDPR-compliant wrapper for external embeds.
 *
 * Blocks the embed until the user has accepted external media consent.
 * Shows a professional placeholder with provider branding, an explanation
 * of the data transfer, a privacy policy link, and an opt-in button.
 * Reacts immediately to ConsentBanner decisions via a custom DOM event.
 *
 * Consent is persisted in a first-party cookie so it survives page reloads
 * in all privacy contexts. Pass `initialConsent` from a server component to
 * avoid the hydration flash entirely.
 */
export function ConsentGate({
  children,
  label = 'Load external content',
  title,
  providerIcon,
  placeholderUrl,
  placeholderAlt = 'External content — click to load',
  gateText = 'This content is provided by an external provider. Loading it will transfer data to that provider as described in our privacy policy.',
  privacyPolicyUrl,
  privacyPolicyLabel = 'Privacy Policy',
  initialConsent,
}: ConsentGateProps) {
  const [consent, setConsent] = useState<ConsentState>(initialConsent ?? null)

  useEffect(() => {
    // Hydrate from cookie (or migrate legacy localStorage value)
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
    <div className="relative w-full rounded-xl overflow-hidden bg-card border border-border/60 shadow-lg flex items-center justify-center min-h-[180px]">
      {/* Placeholder background — R2 image if configured, else brand gradient */}
      {placeholderUrl ? (
        <Image
          src={placeholderUrl}
          alt={placeholderAlt}
          fill
          className="object-cover opacity-20"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
      )}

      {/* Centered consent card */}
      <div className="relative z-10 flex flex-col items-center gap-4 px-6 py-8 text-center max-w-sm mx-auto">
        {/* Provider icon + title */}
        {(providerIcon || title) && (
          <div className="flex items-center gap-2">
            {providerIcon}
            {title && (
              <span className="text-base font-semibold text-foreground tracking-tight">
                {title}
              </span>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="w-8 h-px bg-border/60" />

        {/* Gate description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {gateText}{' '}
          {privacyPolicyUrl && (
            <Link
              href={privacyPolicyUrl}
              className="underline underline-offset-2 hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {privacyPolicyLabel}
            </Link>
          )}
        </p>

        {/* CTA */}
        <Button
          size="sm"
          onClick={handleAccept}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs px-5"
        >
          <ShieldCheck size={14} weight="fill" aria-hidden="true" />
          {label}
        </Button>
      </div>
    </div>
  )
}
