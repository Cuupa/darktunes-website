'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { getJournalistDownloadUrl } from '../../_actions/download'
import type { PressPhoto } from '@/lib/api/pressPhotos'

interface PressKitListProps {
  photos: PressPhoto[]
}

export function PressKitList({ photos }: PressKitListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const download = async (photo: PressPhoto) => {
    setLoadingId(photo.id)
    try {
      const result = await getJournalistDownloadUrl(photo.r2Key, null)
      if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Press Kit</h1>
      {photos.map((photo) => (
        <div key={photo.id} className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">{photo.title}</p>
            <p className="text-sm text-muted-foreground">{photo.altText ?? 'Press photo'}</p>
          </div>
          <Button size="sm" onClick={() => void download(photo)} disabled={loadingId === photo.id}>
            {loadingId === photo.id ? 'Preparing…' : 'Download'}
          </Button>
        </div>
      ))}
      {photos.length === 0 && <p className="text-sm text-muted-foreground">No press kit assets available.</p>}
    </div>
  )
}
