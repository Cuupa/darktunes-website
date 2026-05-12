'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { getJournalistDownloadUrl } from '../../_actions/download'
import type { Release } from '@/types'

interface PromoDownloadsProps {
  releases: Release[]
}

export function PromoDownloads({ releases }: PromoDownloadsProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const download = async (release: Release) => {
    const key = release.coverArt || release.previewUrl || release.id
    setLoadingId(release.id)
    try {
      const result = await getJournalistDownloadUrl(key, release.id)
      if (result.url) {
        window.open(result.url, '_blank', 'noopener,noreferrer')
      }
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Promo Pool</h1>
      {releases.map((release) => (
        <div key={release.id} className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">{release.title}</p>
            <p className="text-sm text-muted-foreground">{release.artistName}</p>
          </div>
          <Button size="sm" onClick={() => void download(release)} disabled={loadingId === release.id}>
            {loadingId === release.id ? 'Preparing…' : 'Download'}
          </Button>
        </div>
      ))}
      {releases.length === 0 && <p className="text-sm text-muted-foreground">No promo releases available.</p>}
    </div>
  )
}
