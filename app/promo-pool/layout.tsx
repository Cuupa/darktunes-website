/**
 * app/promo-pool/layout.tsx — Promo Pool layout (Server Component)
 *
 * Second layer of protection (after Edge Middleware):
 *   - Middleware guarantees the user is authenticated.
 *   - This layout checks that the user has the 'journalist' or 'admin' role.
 *   - Non-journalists see PromoPoolAccessGate (application status / apply form)
 *     instead of the protected content.
 */

export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
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
