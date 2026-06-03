export const dynamic = 'force-dynamic'

import type { ReactNode } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { PressNav } from './_components/PressNav'

export default async function PressDashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const flags = await getFeatureFlagsForRole(supabase, 'journalist').catch(() => ({} as Record<string, boolean>))
  const links = [
    { href: '/press/dashboard', label: 'Overview', enabled: true },
    { href: '/press/dashboard/promo-pool', label: 'Promo Pool', enabled: true },
    { href: '/press/dashboard/press-kit', label: 'Press Kit', enabled: true },
    { href: '/press/dashboard/press-releases', label: 'Press Releases', enabled: true },
    { href: '/press/dashboard/accreditation', label: 'Accreditation', enabled: flags['journalist.accreditation'] ?? true },
    { href: '/press/dashboard/download-history', label: 'Download History', enabled: true },
  ].filter((item) => item.enabled).map(({ href, label }) => ({ href, label }))

  return (
    <div className="min-h-screen bg-background flex">
      <PressNav email={user.email ?? ''} links={links} />
      <main className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full">{children}</main>
    </div>
  )
}
