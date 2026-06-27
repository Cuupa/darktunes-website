'use client'

import { useEffect, useState } from 'react'
import { Rect, Image as KonvaImage } from 'react-konva'
import { resolveEpkCanvasImageSrc } from '@/lib/epk/epkImageProxy'
import { parseGradientFromBackground } from '@/lib/epk/gradients'
import { getKonvaRectFillProps } from '@/lib/epk/konvaFill'
import type { EpkPage } from '@/lib/epk/schema/documentV2'

function useHtmlImage(src: string | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!src) {
      setImage(null)
      return
    }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.onerror = () => setImage(null)
    img.src = resolveEpkCanvasImageSrc(src)
  }, [src])

  return image
}

interface EpkPageBackgroundLayerProps {
  page: EpkPage
}

export function EpkPageBackgroundLayer({ page }: EpkPageBackgroundLayerProps) {
  const bgImage = useHtmlImage(
    page.background.type === 'image' ? page.background.src : undefined,
  )

  if (page.background.type === 'color' || page.background.type === 'gradient') {
    return (
      <Rect
        x={0}
        y={0}
        width={page.width}
        height={page.height}
        {...getKonvaRectFillProps(
          page.width,
          page.height,
          page.background.color ?? '#101010',
          page.background.type === 'gradient'
            ? parseGradientFromBackground(page.background)
            : null,
        )}
        listening={false}
      />
    )
  }

  if (page.background.type === 'image' && bgImage) {
    return (
      <KonvaImage
        x={0}
        y={0}
        width={page.width}
        height={page.height}
        image={bgImage}
        opacity={page.background.opacity ?? 1}
        listening={false}
      />
    )
  }

  return (
    <Rect
      x={0}
      y={0}
      width={page.width}
      height={page.height}
      fill="#101010"
      listening={false}
    />
  )
}