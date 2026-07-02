export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPublicArtists } from '@/lib/api/artists'
import { getPressOnlyNewsPosts } from '@/lib/api/pressReleases'
import { getSiteSettings, SITE_SETTINGS_DEFAULTS } from '@/lib/api/siteSettings'
import { PressLandingClient } from './_components/PressLandingClient'
import { getMetadataBrand, pageTitle } from '@/lib/seo/metadata'

export async function generateMetadata(): Promise<Metadata> {
  const { labelName } = await getMetadataBrand()
  return {
    title: pageTitle('Press & Media', labelName),
    description: 'Label press portal with artist press kits, media contacts, and exclusive press releases.',
  }
}

export default async function PressPage() {
  const supabase = await createServerSupabaseClient()

  const [artists, pressReleases, siteSettings] = await Promise.all([
    getPublicArtists(supabase).catch((err: unknown) => {
      console.error('[press/page] Failed to fetch artists:', err)
      return []
    }),
    getPressOnlyNewsPosts(supabase).then((posts) => posts.slice(0, 6)).catch((err: unknown) => {
      console.error('[press/page] Failed to fetch press releases:', err)
      return []
    }),
    getSiteSettings(supabase).catch((err: unknown) => {
      console.error('[press/page] Failed to fetch site settings:', err)
      return SITE_SETTINGS_DEFAULTS
    }),
  ])

  return (
    <PressLandingClient
      artists={artists}
      pressReleases={pressReleases}
      siteSettings={siteSettings}
    />
  )
}