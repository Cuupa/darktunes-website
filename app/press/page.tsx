export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPublicArtists } from '@/lib/api/artists'
import { getPressOnlyNewsPosts } from '@/lib/api/pressReleases'
import { getSiteSettings } from '@/lib/api/siteSettings'
import { PressLandingClient } from './_components/PressLandingClient'

export const metadata: Metadata = {
  title: 'Press & Media — darkTunes Music Group',
  description: 'Label press portal with artist press kits, media contacts, and exclusive press releases.',
}

export default async function PressPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const supabase = await createServerSupabaseClient()

  const [artists, pressReleases, siteSettings] = await Promise.all([
    getPublicArtists(supabase).catch(() => []),
    getPressOnlyNewsPosts(supabase).then((posts) => posts.slice(0, 3)).catch(() => []),
    getSiteSettings(supabase).catch(() => ({
      labelName: 'darkTunes Music Group',
      labelTagline: '',
      contactEmail: 'info@darktunes.com',
    })),
  ])

  return (
    <PressLandingClient
      artists={artists}
      pressReleases={pressReleases}
      siteSettings={siteSettings}
      pressDict={dict.press}
      releasesDict={dict.pressReleases}
    />
  )
}
