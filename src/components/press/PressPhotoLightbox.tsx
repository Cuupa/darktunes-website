'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { CaretLeft, CaretRight, DownloadSimple, X } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import { cn } from '@/lib/utils'
import type { PressAsset } from '@/types'
import type { DialogProps } from '@/lib/component-contracts'

const MODAL_SPRING = { type: 'spring', stiffness: 400, damping: 40 } as const

export interface PressPhotoLightboxProps extends DialogProps {
  photos: PressAsset[]
  initialIndex?: number
  artistName?: string
  onDownload?: (photo: PressAsset) => void
}

function pressAssetTitle(photo: PressAsset): string {
  return photo.pressCaption ?? photo.originalFilename
}

export function PressPhotoLightbox({
  photos,
  initialIndex = 0,
  artistName,
  open,
  onClose,
  onDownload,
}: PressPhotoLightboxProps) {
  const prefersReducedMotion = useReducedMotion()
  const [index, setIndex] = useState(initialIndex)

  useEffect(() => {
    if (open) setIndex(initialIndex)
  }, [open, initialIndex])

  const photo = photos[index] ?? null
  const hasPrev = index > 0
  const hasNext = index < photos.length - 1

  const goPrev = useCallback(() => {
    if (hasPrev) setIndex((value) => value - 1)
  }, [hasPrev])

  const goNext = useCallback(() => {
    if (hasNext) setIndex((value) => value + 1)
  }, [hasNext])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') goPrev()
      if (event.key === 'ArrowRight') goNext()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, goPrev, goNext])

  if (!photo) return null

  const title = pressAssetTitle(photo)
  const alt = photo.altText ?? `${artistName ?? 'Artist'} – press photo`

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        aria-labelledby="press-lightbox-title"
        aria-describedby={undefined}
        className="max-w-[calc(100%-2rem)] gap-0 overflow-hidden border-border bg-background/95 p-0 backdrop-blur-xl sm:max-w-[95vw] md:max-w-[95vw] lg:max-w-[95vw]"
      >
        <DialogTitle id="press-lightbox-title" className="sr-only">{title}</DialogTitle>
        <AnimatePresence mode="wait">
          {open && (
            <motion.div
              key={photo.id}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              transition={prefersReducedMotion ? { duration: 0 } : MODAL_SPRING}
              className="flex max-h-[92vh] flex-col"
            >
              <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close press photo viewer"
                  className="absolute right-4 top-4 z-50 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X size={20} weight="bold" aria-hidden="true" />
                </button>

                {photos.length > 1 && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!hasPrev}
                      onClick={goPrev}
                      aria-label="Previous photo"
                      className="absolute left-4 top-1/2 z-50 min-h-[44px] min-w-[44px] -translate-y-1/2"
                    >
                      <CaretLeft size={20} weight="bold" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!hasNext}
                      onClick={goNext}
                      aria-label="Next photo"
                      className="absolute right-4 top-1/2 z-50 min-h-[44px] min-w-[44px] -translate-y-1/2"
                    >
                      <CaretRight size={20} weight="bold" aria-hidden="true" />
                    </Button>
                  </>
                )}

                <div className="relative aspect-[4/3] w-full max-w-5xl overflow-hidden rounded-lg">
                  <Image
                    src={getOptimizedImageUrl(photo.publicUrl, 1600)}
                    alt={alt}
                    fill
                    unoptimized
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-border bg-card/60 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-lg font-semibold">{title}</p>
                    <p className={cn('text-sm text-muted-foreground')}>
                      {[photo.pressCategory, photo.photographerCredit].filter(Boolean).join(' · ')}
                      {photos.length > 1 && ` · ${index + 1} / ${photos.length}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {onDownload ? (
                      <Button type="button" variant="outline" className="gap-2" onClick={() => onDownload(photo)}>
                        <DownloadSimple size={16} weight="bold" aria-hidden="true" />
                        Download
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" className="gap-2" asChild>
                        <a href={photo.publicUrl} target="_blank" rel="noopener noreferrer" download>
                          <DownloadSimple size={16} weight="bold" aria-hidden="true" />
                          Download
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}