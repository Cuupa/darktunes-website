'use client'

/**
 * app/promo-pool/_components/PromoPoolClient.tsx
 *
 * Renders the list of promo tracks. Each track has a "Stream" button that
 * calls the getPromoTrackStreamUrl() Server Action to obtain a short-lived
 * presigned GET URL — the R2 key is never exposed in the initial HTML.
 */

import { useState } from 'react'
import { Play, SpinnerGap, WarningCircle, MusicNote } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getPromoTrackStreamUrl } from '@/actions/promoTrack'
import type { PromoTrack } from '@/lib/api/promoTracks'
import { useTranslations } from 'next-intl'

interface Props {
  tracks: PromoTrack[]
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function TrackCard({ track }: { track: PromoTrack }) {
  const t = useTranslations('promoPool')
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const handleStream = async () => {
    setLoading(true)
    setError(false)
    try {
      const { url } = await getPromoTrackStreamUrl(track.r2Key)
      setStreamUrl(url)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <MusicNote size={20} className="text-primary flex-shrink-0" weight="fill" aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold truncate">{track.title}</p>
              <p className="text-sm text-muted-foreground truncate">{track.artistName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 text-xs text-muted-foreground">
            {track.durationSeconds !== undefined && (
              <span>{formatDuration(track.durationSeconds)}</span>
            )}
            {track.fileSizeBytes !== undefined && (
              <span>{formatBytes(track.fileSizeBytes)}</span>
            )}
          </div>
        </div>

        {!streamUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStream}
            disabled={loading}
            className="gap-2 w-full sm:w-auto"
            aria-label={`${t('streamTrack')}: ${track.title}`}
          >
            {loading ? (
              <SpinnerGap size={14} weight="bold" className="animate-spin" aria-hidden />
            ) : (
              <Play size={14} weight="fill" aria-hidden />
            )}
            {loading ? t('loading') : t('streamTrack')}
          </Button>
        )}

        {error && (
          <p className="text-destructive text-sm flex items-center gap-1" role="alert">
            <WarningCircle size={14} weight="bold" aria-hidden />
            {t('streamError')}
          </p>
        )}

        {streamUrl && (
          <audio
            controls
            autoPlay
            src={streamUrl}
            className="w-full"
            aria-label={`${track.title} by ${track.artistName}`}
          />
        )}
      </CardContent>
    </Card>
  )
}

export function PromoPoolClient({ tracks }: Props) {
  const t = useTranslations('promoPool')

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('heading')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </header>

      <section className="space-y-4" aria-label="Promo tracks">
        <h2 className="text-xl font-semibold">{t('tracksHeading')}</h2>
        {tracks.length === 0 ? (
          <p className="text-muted-foreground">{t('noTracks')}</p>
        ) : (
          <div className="space-y-3">
            {tracks.map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
