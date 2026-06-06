export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { PressNav } from './_components/PressNav'

export const metadata: Metadata = {
  title: 'Press Dashboard — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default async function PressDashboardLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const flags = await getFeatureFlagsForRole(supabase, 'journalist').catch(() => ({} as Record<string, boolean>))
  const links = [
    { href: '/press/dashboard', label: dict.pressDashboard.overview, enabled: true },
    { href: '/press/dashboard/profile', label: dict.pressDashboard.profile, enabled: true },
    { href: '/press/dashboard/promo-pool', label: dict.pressDashboard.promoPool, enabled: true },
    { href: '/press/dashboard/press-kit', label: dict.pressDashboard.pressKit, enabled: true },
    { href: '/press/dashboard/press-releases', label: dict.pressDashboard.pressReleases, enabled: true },
    { href: '/press/dashboard/interviews', label: dict.pressDashboard.interviews, enabled: true },
    { href: '/press/dashboard/accreditation', label: dict.pressDashboard.accreditation, enabled: flags['journalist.accreditation'] ?? true },
    { href: '/press/dashboard/contact', label: dict.pressDashboard.contact, enabled: flags['press.contact'] ?? true },
    { href: '/press/dashboard/download-history', label: dict.pressDashboard.downloadHistory, enabled: true },
  ].filter((item) => item.enabled).map(({ href, label }) => ({ href, label }))

  return (
    <div className="min-h-screen bg-background md:flex">
      <PressNav email={user.email ?? ''} links={links} />
      <main className="mx-auto w-full max-w-5xl flex-1 p-6 md:p-8">{children}</main>
    </div>
  )
}
