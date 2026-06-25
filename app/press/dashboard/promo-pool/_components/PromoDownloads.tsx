'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PromoTrackPlayer } from '@/components/press/PromoTrackPlayer'
import { getJournalistDownloadUrl } from '../../_actions/download'
import type { Release } from '@/types'
import type { PromoTrack } from '@/lib/api/promoTracks'

interface PromoDownloadsProps {
  releases: Release[]
  promoTracks: PromoTrack[]
}

export function PromoDownloads({ releases, promoTracks }: PromoDownloadsProps) {
  const t = useTranslations('promoPool')
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
      <h1 className="text-3xl font-bold">{t('heading')}</h1>

      <section className="space-y-3" aria-labelledby="promo-releases-heading">
        <h2 id="promo-releases-heading" className="text-xl font-semibold">{t('releasesHeading')}</h2>
        {releases.map((release) => (
          <Card key={release.id} className="border-border bg-card/70">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{release.title}</p>
                <p className="text-sm text-muted-foreground">{release.artistName}</p>
              </div>
              <Button size="sm" onClick={() => void download(release)} disabled={loadingId === release.id}>
                {loadingId === release.id ? t('player.preparing') : t('player.download')}
              </Button>
            </CardContent>
          </Card>
        ))}
        {releases.length === 0 && <p className="text-sm text-muted-foreground">{t('noReleases')}</p>}
      </section>

      <section className="space-y-3" aria-labelledby="promo-tracks-heading">
        <h2 id="promo-tracks-heading" className="text-xl font-semibold">{t('tracksHeading')}</h2>
        {promoTracks.map((track) => <PromoTrackPlayer key={track.id} track={track} />)}
        {promoTracks.length === 0 && <p className="text-sm text-muted-foreground">{t('noTracks')}</p>}
      </section>
    </div>
  )
}