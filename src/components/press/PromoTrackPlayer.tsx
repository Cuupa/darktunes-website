'use client'

import { useRef, useState } from 'react'
import { Download, Pause, Play } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { getPromoStreamUrl } from '../../../app/press/dashboard/promo-pool/_actions/stream'
import { getJournalistDownloadUrl } from '../../../app/press/dashboard/_actions/download'
import type { PromoTrack } from '@/lib/api/promoTracks'

interface PromoTrackPlayerProps {
  track: PromoTrack
  audioPreviewEnabled?: boolean
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PromoTrackPlayer({ track, audioPreviewEnabled = true }: PromoTrackPlayerProps) {
  const t = useTranslations('promoPool')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingDownload, setLoadingDownload] = useState(false)
  const [showNdaModal, setShowNdaModal] = useState(false)
  const [ndaChecked, setNdaChecked] = useState(false)

  const togglePlay = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }

    setLoadingPreview(true)
    try {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      const { url } = await getPromoStreamUrl(track.r2Key)
      if (!url) {
        toast.error(t('streamError'))
        return
      }
      const audio = new Audio(url)
      audioRef.current = audio
      audio.addEventListener('ended', () => setIsPlaying(false))
      await audio.play()
      setIsPlaying(true)
    } catch {
      toast.error(t('streamError'))
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleDownload = () => {
    if (track.ndaRequired) {
      setShowNdaModal(true)
    } else {
      void doDownload()
    }
  }

  const doDownload = async () => {
    setLoadingDownload(true)
    try {
      const { url } = await getJournalistDownloadUrl(track.r2Key, null)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setLoadingDownload(false)
      setShowNdaModal(false)
      setNdaChecked(false)
    }
  }

  return (
    <>
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{track.title}</p>
            <p className="text-sm text-muted-foreground">{track.artistName}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            {audioPreviewEnabled && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void togglePlay()}
                disabled={loadingPreview}
                aria-label={isPlaying ? `${t('player.pause')} ${track.title}` : `${t('player.preview')} ${track.title}`}
              >
                {isPlaying ? <Pause size={14} weight="bold" aria-hidden="true" /> : <Play size={14} weight="bold" aria-hidden="true" />}
                {loadingPreview ? t('loading') : isPlaying ? t('player.pause') : t('player.preview')}
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={loadingDownload}
              aria-label={`${t('player.download')} ${track.title}`}
            >
              <Download size={14} weight="bold" aria-hidden="true" />
              {loadingDownload ? t('player.preparing') : t('player.download')}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {track.genre && <Badge variant="secondary">{track.genre}</Badge>}
          {track.bpm && <span>BPM: {track.bpm}</span>}
          {track.key && <span>Key: {track.key}</span>}
          {track.durationSeconds && <span>{formatDuration(track.durationSeconds)}</span>}
          {track.releaseDate && <span>{new Date(track.releaseDate).toLocaleDateString()}</span>}
          {track.ndaRequired && <Badge variant="destructive" className="text-xs">{t('nda.badge')}</Badge>}
        </div>
      </div>

      <Dialog open={showNdaModal} onOpenChange={setShowNdaModal}>
        <DialogContent aria-labelledby="nda-title" className="max-w-[calc(100%-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle id="nda-title">{t('nda.title')}</DialogTitle>
            <DialogDescription>
              {t('nda.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox id="nda-agree" checked={ndaChecked} onCheckedChange={(value) => setNdaChecked(value === true)} />
            <Label htmlFor="nda-agree">{t('nda.confirm')}</Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNdaModal(false)}>{t('nda.cancel')}</Button>
            <Button disabled={!ndaChecked || loadingDownload} onClick={() => void doDownload()}>
              {loadingDownload ? t('player.preparing') : t('nda.proceed')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}