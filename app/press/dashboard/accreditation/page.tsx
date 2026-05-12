export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { AccreditationClient } from './_components/AccreditationClient'

export default async function AccreditationPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const flags = await getFeatureFlagsForRole(supabase, 'journalist').catch(() => ({} as Record<string, boolean>))
  if (flags['journalist.accreditation'] === false) {
    return <p className="text-muted-foreground">Accreditation requests are currently disabled.</p>
  }

  const { data } = await supabase
    .from('accreditation_requests')
    .select('*')
    .eq('journalist_id', user.id)
    .order('created_at', { ascending: false })

  return <AccreditationClient initialRequests={data ?? []} journalistId={user.id} />
}
