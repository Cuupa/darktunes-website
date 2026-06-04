export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { getDownloadHistory } from '@/lib/api/journalistDownloads'
import { getInterviewRequestsByJournalistId } from '@/lib/api/interviewRequests'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { JournalistDashboardClient } from './_components/JournalistDashboardClient'
import type { AccreditationRequest } from '@/types'

export default async function PressDashboardPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const flags = await getFeatureFlagsForRole(supabase, 'journalist').catch(() => ({} as Record<string, boolean>))
  const [downloads, interviewRequests, accreditationRows] = await Promise.all([
    getDownloadHistory(supabase, user.id).catch(() => []),
    getInterviewRequestsByJournalistId(supabase, user.id).catch(() => []),
    supabase
      .from('accreditation_requests')
      .select('*')
      .eq('journalist_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const accreditations: AccreditationRequest[] = (accreditationRows.data ?? []).map((row) => ({
    id: row.id,
    journalistId: row.journalist_id,
    eventName: row.event_name,
    eventDate: row.event_date,
    publication: row.publication,
    reason: row.reason,
    status: row.status,
    adminNote: row.admin_note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  const cards = [
    { href: '/press/dashboard/profile', label: dict.pressDashboard.profile, enabled: true },
    { href: '/press/dashboard/promo-pool', label: dict.pressDashboard.promoPool, enabled: true },
    { href: '/press/dashboard/press-kit', label: dict.pressDashboard.pressKit, enabled: true },
    { href: '/press/dashboard/press-releases', label: dict.pressDashboard.pressReleases, enabled: true },
    { href: '/press/dashboard/accreditation', label: dict.pressDashboard.accreditation, enabled: flags['journalist.accreditation'] ?? true },
    { href: '/press/dashboard/contact', label: dict.pressDashboard.contact, enabled: flags['press.contact'] ?? true },
    { href: '/press/dashboard/download-history', label: dict.pressDashboard.downloadHistory, enabled: true },
    { href: '/press/dashboard/interviews', label: dict.pressDashboard.interviews, enabled: true },
  ].filter((item) => item.enabled)

  return (
    <JournalistDashboardClient
      title={dict.pressDashboard.title}
      cards={cards}
      downloads={downloads}
      accreditations={accreditations}
      interviews={interviewRequests}
      labels={{
        interviews: dict.pressDashboard.interviews,
        open: dict.pressDashboard.open,
        noInterviews: dict.pressDashboard.noInterviews,
        downloadHistory: dict.pressDashboard.downloadHistory,
        noDownloads: dict.pressDashboard.noDownloads,
        accreditation: dict.pressDashboard.accreditation,
        noAccreditations: dict.pressDashboard.noAccreditations,
      }}
    />
  )
}
