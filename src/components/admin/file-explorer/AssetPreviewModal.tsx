'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowCounterClockwise, ArrowsOut, Copy, DownloadSimple, X } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { Asset } from '@/types'
import { isImageAsset } from './utils'

interface AssetPreviewModalProps {
  asset: Asset | null
  onClose: () => void
}

export function AssetPreviewModal({ asset, onClose }: AssetPreviewModalProps) {
  const open = asset !== null
  const [rotation, setRotation] = useState(0)
  const [isCropping, setIsCropping] = useState(false)
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null)
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Reset state when a new asset is opened
  useEffect(() => {
    if (open) {
      setRotation(0)
      setIsCropping(false)
      setCropStart(null)
      setCropRect(null)
    }
  }, [asset?.id, open])

  const rotate = () => setRotation((prev) => (prev + 90) % 360)

  const copyUrl = useCallback(() => {
    if (!asset) return
    void navigator.clipboard.writeText(asset.publicUrl).then(() => toast.success('URL copied'))
  }, [asset])

  const download = useCallback(() => {
    if (!asset) return
    window.open(asset.publicUrl, '_blank', 'noopener,noreferrer')
  }, [asset])

  // Canvas-based crop: draw rotated image then crop selection
  const applyCrop = useCallback(() => {
    if (!asset || !imgRef.current || !canvasRef.current || !cropRect) return
    const img = imgRef.current
    const canvas = canvasRef.current
    const { x, y, w, h } = cropRect

    // Source pixel coordinates in the natural image
    const scaleX = img.naturalWidth / img.width
    const scaleY = img.naturalHeight / img.height
    canvas.width = Math.abs(w * scaleX)
    canvas.height = Math.abs(h * scaleY)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(
      img,
      Math.min(x, x + w) * scaleX,
      Math.min(y, y + h) * scaleY,
      Math.abs(w * scaleX),
      Math.abs(h * scaleY),
      0,
      0,
      canvas.width,
      canvas.height,
    )
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cropped-${asset.originalFilename}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Cropped image downloaded')
    }, 'image/png')

    setIsCropping(false)
    setCropRect(null)
  }, [asset, cropRect])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCropping) return
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setCropStart({ x, y })
    setCropRect({ x, y, w: 0, h: 0 })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCropping || !cropStart) return
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setCropRect({ x: cropStart.x, y: cropStart.y, w: x - cropStart.x, h: y - cropStart.y })
  }

  const handleMouseUp = () => {
    if (!isCropping) return
    setCropStart(null)
  }

  if (!asset) return null

  const isImage = isImageAsset(asset)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0"
        aria-labelledby="preview-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <DialogTitle id="preview-title" className="truncate text-sm font-medium">
              {asset.originalFilename}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {asset.mimeType}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-1">
            {isImage && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Rotate 90°"
                  onClick={rotate}
                  className="size-8"
                >
                  <ArrowCounterClockwise size={16} aria-hidden="true" />
                  <span className="sr-only">Rotate 90°</span>
                </Button>
                <Button
                  variant={isCropping ? 'default' : 'ghost'}
                  size="icon"
                  title={isCropping ? 'Cancel crop' : 'Crop'}
                  onClick={() => {
                    setIsCropping((v) => !v)
                    setCropRect(null)
                    setCropStart(null)
                  }}
                  className="size-8"
                >
                  <ArrowsOut size={16} aria-hidden="true" />
                  <span className="sr-only">{isCropping ? 'Cancel crop' : 'Crop'}</span>
                </Button>
                {cropRect && Math.abs(cropRect.w) > 5 && Math.abs(cropRect.h) > 5 && (
                  <Button size="sm" onClick={applyCrop}>
                    Download crop
                  </Button>
                )}
              </>
            )}
            <Button variant="ghost" size="icon" title="Copy URL" onClick={copyUrl} className="size-8">
              <Copy size={16} aria-hidden="true" />
              <span className="sr-only">Copy URL</span>
            </Button>
            <Button variant="ghost" size="icon" title="Download" onClick={download} className="size-8">
              <DownloadSimple size={16} aria-hidden="true" />
              <span className="sr-only">Download</span>
            </Button>
            <Button variant="ghost" size="icon" title="Close" onClick={onClose} className="size-8">
              <X size={16} aria-hidden="true" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>

        {/* Preview area */}
        <div className="relative flex flex-1 items-center justify-center overflow-auto bg-background/40 p-4">
          {isImage ? (
            <div
              className="relative inline-block"
              style={{ cursor: isCropping ? 'crosshair' : 'default' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {/* Hidden canvas for crop rendering */}
              <canvas ref={canvasRef} className="hidden" />
              {/* eslint-disable-next-line @next/next/no-img-element -- canvas crop requires naturalWidth/naturalHeight from the raw img element */}
              <img
                ref={imgRef}
                src={asset.publicUrl}
                alt={asset.originalFilename}
                className="max-h-[70vh] max-w-full select-none rounded-md object-contain shadow-lg"
                style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s' }}
                draggable={false}
              />
              {isCropping && cropRect && Math.abs(cropRect.w) > 2 && Math.abs(cropRect.h) > 2 && (
                <div
                  className="pointer-events-none absolute border-2 border-primary bg-primary/10"
                  style={{
                    left: Math.min(cropRect.x, cropRect.x + cropRect.w),
                    top: Math.min(cropRect.y, cropRect.y + cropRect.h),
                    width: Math.abs(cropRect.w),
                    height: Math.abs(cropRect.h),
                  }}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-12 text-muted-foreground">
              <p className="text-sm">{asset.mimeType}</p>
              <p className="text-xs">No preview available for this file type.</p>
              <Button variant="outline" onClick={download}>
                <DownloadSimple size={16} className="mr-2" aria-hidden="true" />
                Download file
              </Button>
            </div>
          )}
        </div>

        {isCropping && (
          <div className="border-t border-border bg-card/80 px-4 py-2 text-xs text-muted-foreground">
            Click and drag on the image to select a crop region, then click <strong>Download crop</strong>.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
