'use client'

import { type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { ErrorBoundary } from 'react-error-boundary'
import { LenisProvider } from '@/components/animations/LenisProvider'
import { ConsentBanner } from '@/components/ConsentBanner'
import { ErrorFallback } from '@/ErrorFallback'
import type { Dictionary } from '@/i18n/types'

interface ProvidersProps {
  children: ReactNode
  consentDict: Dictionary['consent']
}

/**
 * Client-side providers that must wrap the entire app.
 * Mounted once in app/layout.tsx — do NOT nest additional instances.
 *
 * Includes:
 * - LenisProvider: global smooth scrolling (single instance rule)
 * - ConsentBanner: GDPR opt-in for external embeds (Spotify, YouTube)
 * - Toaster: global toast notifications
 * - ErrorBoundary: catches client-side render errors
 */
export function Providers({ children, consentDict }: ProvidersProps) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <LenisProvider>
        {children}
        <ConsentBanner dict={consentDict} />
        <Toaster position="bottom-right" theme="dark" />
      </LenisProvider>
    </ErrorBoundary>
  )
}
