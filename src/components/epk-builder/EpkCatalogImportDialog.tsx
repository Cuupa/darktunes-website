'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Database } from '@phosphor-icons/react'
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
import type { Release, Video } from '@/types'

interface EpkCatalogImportDialogProps {
  open: boolean
  onClose: () => void
  releases: Release[]
  videos: Video[]
  onImport: (selectedReleaseIds: string[], selectedVideoIds: string[]) => void
}

export function EpkCatalogImportDialog({
  open,
  onClose,
  releases,
  videos,
  onImport,
}: EpkCatalogImportDialogProps) {
  const t = useTranslations('portal')
  const visibleReleases = useMemo(
    () => releases.filter((release) => release.isVisible),
    [releases],
  )
  const visibleVideos = useMemo(
    () => videos.filter((video) => video.isVisible),
    [videos],
  )

  const [selectedReleaseIds, setSelectedReleaseIds] = useState<Set<string>>(
    () => new Set(visibleReleases.map((release) => release.id)),
  )
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(
    () => new Set(visibleVideos.map((video) => video.id)),
  )

  const toggleRelease = (id: string, checked: boolean) => {
    setSelectedReleaseIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleVideo = (id: string, checked: boolean) => {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const hasCatalog = visibleReleases.length > 0 || visibleVideos.length > 0
  const hasSelection = selectedReleaseIds.size > 0 || selectedVideoIds.size > 0

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('epk_catalog_import_title')}</DialogTitle>
          <DialogDescription>{t('epk_catalog_import_description')}</DialogDescription>
        </DialogHeader>

        {!hasCatalog ? (
          <p className="text-sm text-muted-foreground">{t('epk_catalog_import_empty')}</p>
        ) : (
          <div className="max-h-[50vh] space-y-6 overflow-y-auto overscroll-contain pr-1" data-lenis-prevent>
            {visibleReleases.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{t('epk_catalog_import_releases')}</p>
                <ul className="space-y-2">
                  {visibleReleases.map((release) => (
                    <li key={release.id} className="flex items-start gap-3">
                      <Checkbox
                        id={`catalog-release-${release.id}`}
                        checked={selectedReleaseIds.has(release.id)}
                        onCheckedChange={(checked) => toggleRelease(release.id, checked === true)}
                      />
                      <Label htmlFor={`catalog-release-${release.id}`} className="text-sm leading-snug">
                        <span className="font-medium">{release.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {release.type.toUpperCase()} · {release.releaseDate}
                        </span>
                      </Label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {visibleVideos.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{t('epk_catalog_import_videos')}</p>
                <ul className="space-y-2">
                  {visibleVideos.map((video) => (
                    <li key={video.id} className="flex items-start gap-3">
                      <Checkbox
                        id={`catalog-video-${video.id}`}
                        checked={selectedVideoIds.has(video.id)}
                        onCheckedChange={(checked) => toggleVideo(video.id, checked === true)}
                      />
                      <Label htmlFor={`catalog-video-${video.id}`} className="text-sm leading-snug">
                        {video.title}
                      </Label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('epk_catalog_import_cancel')}
          </Button>
          <Button
            type="button"
            disabled={!hasSelection}
            onClick={() => {
              onImport([...selectedReleaseIds], [...selectedVideoIds])
              onClose()
            }}
          >
            {t('epk_catalog_import_submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EpkCatalogImportButton({
  onClick,
}: {
  onClick: () => void
}) {
  const t = useTranslations('portal')

  return (
    <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={onClick}>
      <Database size={18} className="mr-2" aria-hidden="true" />
      <span className="hidden sm:inline">{t('epk_catalog_import_button')}</span>
    </Button>
  )
}