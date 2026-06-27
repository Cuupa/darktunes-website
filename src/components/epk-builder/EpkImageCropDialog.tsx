'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { resolveEpkCanvasImageSrc } from '@/lib/epk/epkImageProxy'
import { getDefaultImageCrop } from '@/lib/epk/imageFit'
import type { EpkImageCrop } from '@/lib/epk/schema/documentV2'

interface EpkImageCropDialogProps {
  open: boolean
  src: string
  crop?: EpkImageCrop
  onClose: () => void
  onApply: (crop: EpkImageCrop) => void
}

interface DragState {
  pointerId: number
  edge: 'move' | 'nw' | 'ne' | 'sw' | 'se'
  startX: number
  startY: number
  startCrop: EpkImageCrop
}

const PREVIEW_MAX = 420

function clampCrop(crop: EpkImageCrop, maxW: number, maxH: number): EpkImageCrop {
  const width = Math.max(8, Math.min(crop.width, maxW))
  const height = Math.max(8, Math.min(crop.height, maxH))
  const x = Math.max(0, Math.min(crop.x, maxW - width))
  const y = Math.max(0, Math.min(crop.y, maxH - height))
  return { x, y, width, height }
}

export function EpkImageCropDialog({
  open,
  src,
  crop,
  onClose,
  onApply,
}: EpkImageCropDialogProps) {
  const t = useTranslations('portal')
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [draftCrop, setDraftCrop] = useState<EpkImageCrop | null>(null)
  const dragRef = useRef<DragState | null>(null)

  useEffect(() => {
    if (!open || !src) return
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight }
      setNaturalSize(size)
      setDraftCrop(crop ?? getDefaultImageCrop(size.width, size.height))
    }
    img.onerror = () => {
      setNaturalSize({ width: 0, height: 0 })
      setDraftCrop(null)
    }
    img.src = resolveEpkCanvasImageSrc(src)
  }, [open, src, crop])

  const previewScale =
    naturalSize.width > 0
      ? Math.min(1, PREVIEW_MAX / Math.max(naturalSize.width, naturalSize.height))
      : 1

  const onPointerDown = (
    edge: DragState['edge'],
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (!draftCrop) return
    event.preventDefault()
    dragRef.current = {
      pointerId: event.pointerId,
      edge,
      startX: event.clientX,
      startY: event.clientY,
      startCrop: draftCrop,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || naturalSize.width === 0) return

    const dx = (event.clientX - drag.startX) / previewScale
    const dy = (event.clientY - drag.startY) / previewScale
    const start = drag.startCrop
    let next = { ...start }

    if (drag.edge === 'move') {
      next = clampCrop(
        { ...start, x: start.x + dx, y: start.y + dy },
        naturalSize.width,
        naturalSize.height,
      )
    } else {
      if (drag.edge.includes('w')) {
        next.x = start.x + dx
        next.width = start.width - dx
      }
      if (drag.edge.includes('e')) {
        next.width = start.width + dx
      }
      if (drag.edge.includes('n')) {
        next.y = start.y + dy
        next.height = start.height - dy
      }
      if (drag.edge.includes('s')) {
        next.height = start.height + dy
      }
      next = clampCrop(next, naturalSize.width, naturalSize.height)
    }

    setDraftCrop(next)
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }

  const previewWidth = naturalSize.width * previewScale
  const previewHeight = naturalSize.height * previewScale
  const cropPreview = draftCrop
    ? {
        left: draftCrop.x * previewScale,
        top: draftCrop.y * previewScale,
        width: draftCrop.width * previewScale,
        height: draftCrop.height * previewScale,
      }
    : null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg" aria-labelledby="epk-crop-title">
        <DialogHeader>
          <DialogTitle id="epk-crop-title">{t('epk_editor_crop_title')}</DialogTitle>
          <DialogDescription>{t('epk_editor_crop_desc')}</DialogDescription>
        </DialogHeader>

        {cropPreview && previewWidth > 0 ? (
          <div
            className="relative mx-auto overflow-hidden rounded-md border border-border bg-muted/30"
            style={{ width: previewWidth, height: previewHeight }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            data-lenis-prevent
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveEpkCanvasImageSrc(src)}
              alt=""
              className="block h-full w-full object-contain"
              draggable={false}
            />
            <div
              className="absolute border-2 border-primary bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
              style={{
                left: cropPreview.left,
                top: cropPreview.top,
                width: cropPreview.width,
                height: cropPreview.height,
              }}
            >
              <button
                type="button"
                aria-label={t('epk_editor_crop_move')}
                className="absolute inset-0 cursor-move"
                onPointerDown={(e) => onPointerDown('move', e)}
              />
              {(['nw', 'ne', 'sw', 'se'] as const).map((edge) => (
                <button
                  key={edge}
                  type="button"
                  aria-label={t('epk_editor_crop_resize')}
                  className={`absolute h-3 w-3 rounded-full border border-primary bg-background ${
                    edge === 'nw'
                      ? '-left-1.5 -top-1.5 cursor-nwse-resize'
                      : edge === 'ne'
                        ? '-right-1.5 -top-1.5 cursor-nesw-resize'
                        : edge === 'sw'
                          ? '-bottom-1.5 -left-1.5 cursor-nesw-resize'
                          : '-bottom-1.5 -right-1.5 cursor-nwse-resize'
                  }`}
                  onPointerDown={(e) => onPointerDown(edge, e)}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('epk_editor_crop_loading')}</p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('epk_editor_crop_cancel')}
          </Button>
          <Button
            type="button"
            disabled={!draftCrop}
            onClick={() => {
              if (draftCrop) onApply(draftCrop)
              onClose()
            }}
          >
            {t('epk_editor_crop_apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}