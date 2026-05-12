/**
 * app/promo-pool/layout.tsx — Promo Pool layout (Server Component)
 *
 * Second layer of protection (after Edge Middleware):
 *   - Middleware guarantees the user is authenticated.
 *   - This layout checks that the Promo Pool feature is enabled globally.
 *   - This layout checks that the user has the 'journalist' or 'admin' role.
 *   - Non-journalists see PromoPoolAccessGate (application status / apply form)
 *     instead of the protected content.
 */

export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSiteSettings } from '@/lib/api/siteSettings'
import { getJournalistApplicationByUserId } from '@/lib/api/journalistApplications'
import { PromoPoolAccessGate } from './_components/PromoPoolAccessGate'

export const metadata: Metadata = {
  title: 'Promo Pool — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default async function PromoPoolLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware handles the unauthenticated case; user is always defined here.
  if (!user) return null

  // Check feature toggle — if promo pool is disabled, show "unavailable" message
  const siteSettings = await getSiteSettings(supabase).catch(() => null)
  const promoPoolEnabled = siteSettings?.featureToggles?.promoPool ?? true

  if (!promoPoolEnabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold">Promo Pool Unavailable</h1>
          <p className="text-muted-foreground">
            The Promo Pool is currently disabled. Please check back later or contact the label for more information.
          </p>
        </div>
      </div>
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const hasAccess = profile?.role === 'journalist' || profile?.role === 'admin'

  if (!hasAccess) {
    const application = await getJournalistApplicationByUserId(supabase, user.id).catch(
      () => null,
    )
    return (
      <PromoPoolAccessGate
        dict={dict.promoPool}
        application={application}
        userEmail={user.email ?? ''}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-12 max-w-5xl">{children}</main>
    </div>
  )
}
