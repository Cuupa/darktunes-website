export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function PressDashboardPage() {
  const supabase = await createServerSupabaseClient()
  const flags = await getFeatureFlagsForRole(supabase, 'journalist').catch(() => ({} as Record<string, boolean>))

  const cards = [
    { href: '/press/dashboard/promo-pool', label: 'Promo Pool', enabled: true },
    { href: '/press/dashboard/press-kit', label: 'Press Kit', enabled: true },
    { href: '/press/dashboard/press-releases', label: 'Press Releases', enabled: true },
    { href: '/press/dashboard/accreditation', label: 'Accreditation', enabled: flags['journalist.accreditation'] ?? true },
    { href: '/press/dashboard/download-history', label: 'Download History', enabled: true },
  ].filter((item) => item.enabled)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Welcome to the Journalist Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card className="border-border hover:border-primary/40 transition-colors">
              <CardHeader>
                <CardTitle>{card.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Open {card.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
