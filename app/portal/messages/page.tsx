export const dynamic = 'force-dynamic'

import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { getLabelMessages } from '@/lib/api/labelMessages'
import { MessagesInbox } from './_components/MessagesInbox'

export default async function PortalMessagesPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const artist = await getArtistByUserId(supabase, user.id).catch(() => null)
  if (!artist) return null

  const flags = await getFeatureFlagsForRole(supabase, 'artist').catch(() => ({} as Record<string, boolean>))
  if (flags['artist.messages'] === false) {
    return <p className="text-muted-foreground">Messages are currently disabled.</p>
  }

  const messages = await getLabelMessages(supabase, artist.id).catch(() => [])

  return <MessagesInbox dict={dict.portal} initialMessages={messages} />
}
