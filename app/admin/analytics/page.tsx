/**
 * app/admin/analytics/page.tsx — Label Intelligence Hub (persistent analytics)
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

import { getUserRoleWithClient } from '@/lib/getUserRole'
import { getLabelAnalyticsSnapshot } from '@/lib/api/labelAnalytics'
import { getAllJournalistDownloads } from '@/lib/api/journalistDownloads'
import { listRecentFinancialAuditEvents } from '@/lib/api/financialAudit'
import { getLabelPageEngagementStats } from '@/lib/api/pageEvents'
import { AdminPageShell } from '../_components/AdminPageShell'
import { LabelIntelligenceHub } from '@/components/admin/analytics/LabelIntelligenceHub'
import { Skeleton } from '@/components/ui/skeleton'

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  )
}

async function AnalyticsContent() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?returnTo=/admin/analytics')

  const role = await getUserRoleWithClient(supabase, user.id)
  if (role !== 'admin') redirect('/login?error=unauthorized')

  const [snapshot, pressDownloads, auditEvents, websiteEngagement] = await Promise.all([
    getLabelAnalyticsSnapshot(supabase).catch(() => ({
      periodSummaries: [],
      rosterHealth: [],
      totalLabelStreams: 0,
      totalLabelRevenue: 0,
      artistCountWithData: 0,
    })),
    getAllJournalistDownloads(supabase).catch(() => []),
    listRecentFinancialAuditEvents(supabase, 150).catch(() => []),
    getLabelPageEngagementStats(supabase).catch(() => ({
      totalViews: 0,
      last30DaysViews: 0,
      shopClicks: 0,
      topArtists: [],
    })),
  ])

  return (
    <LabelIntelligenceHub
      snapshot={snapshot}
      pressDownloads={pressDownloads}
      auditEvents={auditEvents}
      websiteEngagement={websiteEngagement}
    />
  )
}

export default function AdminAnalyticsPage() {
  return (
    <AdminPageShell
      title="Label Analytics"
      description="Persistent revenue trends, roster health, press engagement, and financial audit trail."
    >
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent />
      </Suspense>
    </AdminPageShell>
  )
}