export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDownloadHistory } from '@/lib/api/journalistDownloads'
import { getTranslations } from 'next-intl/server'

export default async function DownloadHistoryPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [history, t] = await Promise.all([
    getDownloadHistory(supabase, user.id).catch(() => []),
    getTranslations('pressDashboard'),
  ])

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{t('downloadHistory')}</h1>
      {history.map((entry) => (
        <div key={entry.id} className="rounded-lg border border-border p-4">
          <p className="font-medium">{entry.assetKey}</p>
          <p className="text-sm text-muted-foreground">{new Date(entry.downloadedAt).toLocaleString()}</p>
        </div>
      ))}
      {history.length === 0 && <p className="text-sm text-muted-foreground">{t('noDownloads')}</p>}
    </div>
  )
}
