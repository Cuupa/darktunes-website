/**
 * app/portal/onboarding/page.tsx — Onboarding wizard entry (Server Component)
 *
 * Fetches the current user's linked artist, then renders the OnboardingWizard
 * client component.  If the user has no linked artist they are shown a
 * "not linked" message instead of the wizard.
 */

export const dynamic = 'force-dynamic'

import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { OnboardingWizard } from './_components/OnboardingWizard'

export default async function OnboardingPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const artist = await getArtistByUserId(supabase, user.id).catch(() => null)

  if (!artist) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground text-center max-w-sm">{dict.portal.notLinked}</p>
      </div>
    )
  }

  return <OnboardingWizard dict={dict.portal} artistId={artist.id} />
}
