import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isPressApplicationsEnabled } from '@/lib/pressAccess'
import { ApplyForm } from './_components/ApplyForm'

export const metadata: Metadata = {
  title: 'Apply for Press Access — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default async function PressApplyPage() {
  const supabase = await createServerSupabaseClient()
  const applicationsEnabled = await isPressApplicationsEnabled(supabase)
  if (!applicationsEnabled) {
    const t = await getTranslations('apply')
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{t('heading')}</h1>
        <p className="text-muted-foreground">{t('applicationsDisabled')}</p>
      </div>
    )
  }

  return <ApplyForm />
}