'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { ReleaseSubmission } from '@/types'

function daysLeft(expireAt: string | null | undefined): number | null {
  if (!expireAt) return null
  const ms = new Date(expireAt).getTime() - Date.now()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

export function SubmissionAssetLinks({ submission }: { submission: ReleaseSubmission }) {
  const t = useTranslations('admin')
  const [busy, setBusy] = useState<'audio' | 'cover' | null>(null)
  const remaining = daysLeft(submission.assetsExpireAt)

  const download = async (kind: 'audio' | 'cover') => {
    setBusy(kind)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch(`/api/admin/release-submissions/${submission.id}/assets/${kind}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = (await res.json()) as { download_url?: string; error?: string }
      if (!res.ok || !data.download_url) throw new Error(data.error ?? 'Download failed')
      window.open(data.download_url, '_blank', 'noopener,noreferrer')
    } finally {
      setBusy(null)
    }
  }

  const hasAudio = Boolean(submission.audioR2Key || submission.audioDownloadUrl)
  const hasCover = Boolean(submission.coverR2Key || submission.coverArtUrl)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {hasAudio ? (
          <Button type="button" size="sm" variant="outline" disabled={busy === 'audio'} onClick={() => void download('audio')}>
            {t('submission_download_audio')}
          </Button>
        ) : null}
        {hasCover ? (
          <Button type="button" size="sm" variant="outline" disabled={busy === 'cover'} onClick={() => void download('cover')}>
            {t('submission_download_cover')}
          </Button>
        ) : null}
      </div>
      {remaining != null ? (
        <p className="text-xs text-muted-foreground">
          {remaining < 1
            ? t('submission_files_expire_today')
            : t('submission_files_expire_in', { days: remaining })}
        </p>
      ) : null}
    </div>
  )
}
