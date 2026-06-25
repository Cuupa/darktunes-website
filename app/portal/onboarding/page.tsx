/**
 * app/portal/onboarding/page.tsx — Onboarding wizard entry (Server Component)
 *
 * Fetches the current user's linked artist, then renders the OnboardingWizard
 * client component.  If the user has no linked artist they are shown a
 * "not linked" message instead of the wizard.
 */

export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { OnboardingWizard } from './_components/OnboardingWizard'
import { getTranslations } from 'next-intl/server'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ artistId?: string }>
}) {
  const t = await getTranslations('portal')

  const { artistId } = await searchParams

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch(() => null)

  if (!artist) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground text-center max-w-sm">{t('notLinked')}</p>
      </div>
    )
  }

  return <OnboardingWizard artistId={artist.id} />
}