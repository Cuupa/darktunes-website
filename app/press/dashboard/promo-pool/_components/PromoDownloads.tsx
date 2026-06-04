'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PromoTrackPlayer } from '@/components/press/PromoTrackPlayer'
import { getJournalistDownloadUrl } from '../../_actions/download'
import type { Dictionary } from '@/i18n/types'
import type { Release } from '@/types'
import type { PromoTrack } from '@/lib/api/promoTracks'

interface PromoDownloadsProps {
  releases: Release[]
  promoTracks: PromoTrack[]
  dict: Dictionary['promoPool']
}

export function PromoDownloads({ releases, promoTracks, dict }: PromoDownloadsProps) {
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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{dict.heading}</h1>

      <section className="space-y-3" aria-labelledby="promo-releases-heading">
        <h2 id="promo-releases-heading" className="text-xl font-semibold">Promo Releases</h2>
        {releases.map((release) => (
          <Card key={release.id} className="border-border bg-card/70">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{release.title}</p>
                <p className="text-sm text-muted-foreground">{release.artistName}</p>
              </div>
              <Button size="sm" onClick={() => void download(release)} disabled={loadingId === release.id}>
                {loadingId === release.id ? dict.player.preparing : dict.player.download}
              </Button>
            </CardContent>
          </Card>
        ))}
        {releases.length === 0 && <p className="text-sm text-muted-foreground">No promo releases available.</p>}
      </section>

      <section className="space-y-3" aria-labelledby="promo-tracks-heading">
        <h2 id="promo-tracks-heading" className="text-xl font-semibold">Promo Tracks</h2>
        {promoTracks.map((track) => <PromoTrackPlayer key={track.id} track={track} />)}
        {promoTracks.length === 0 && <p className="text-sm text-muted-foreground">{dict.noTracks}</p>}
      </section>
    </div>
  )
}
