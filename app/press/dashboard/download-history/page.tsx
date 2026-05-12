export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { getDownloadHistory } from '@/lib/api/journalistDownloads'

export default async function DownloadHistoryPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const flags = await getFeatureFlagsForRole(supabase, 'journalist').catch(() => ({} as Record<string, boolean>))
  if (flags['journalist.download_history'] === false) {
    return <p className="text-muted-foreground">Download history is currently disabled.</p>
  }

  const history = await getDownloadHistory(supabase, user.id).catch(() => [])

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Download History</h1>
      {history.map((entry) => (
        <div key={entry.id} className="rounded-lg border border-border p-4">
          <p className="font-medium">{entry.assetKey}</p>
          <p className="text-sm text-muted-foreground">{new Date(entry.downloadedAt).toLocaleString()}</p>
        </div>
      ))}
      {history.length === 0 && <p className="text-sm text-muted-foreground">No downloads yet.</p>}
    </div>
  )
}
