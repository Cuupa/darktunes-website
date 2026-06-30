'use client'

import type { FanPageImageProps } from '@/lib/fan-page/schema/documentV1'
import { resolveThemeColors } from '@/lib/fan-page/theme/resolveThemeColors'
import type { FanPageTheme } from '@/lib/fan-page/schema/documentV1'
import { FanPageImage } from './FanPageImage'

interface GalleryBlockProps {
  images?: FanPageImageProps[]
  theme: FanPageTheme
  title?: string
  columns?: number
}

export function GalleryBlock({ images = [], theme, title, columns = 3 }: GalleryBlockProps) {
  const colors = resolveThemeColors(theme)
  const cols = Math.min(4, Math.max(2, columns))

  if (images.length === 0) {
    return <p className="text-sm opacity-60">—</p>
  }

  return (
    <div>
      {title ? (
        <h2 className="mb-6 text-2xl font-bold tracking-tight" style={{ color: colors.primary }}>
          {title}
        </h2>
      ) : null}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {images.map((image, index) => (
          <div key={image.src ?? index} className="relative aspect-square overflow-hidden rounded-lg">
            <FanPageImage image={image} alt={image.alt ?? `Gallery ${index + 1}`} fill width={500} />
          </div>
        ))}
      </div>
    </div>
  )
}