'use client'

import { ShoppingBag } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import type { FanPageImageProps } from '@/lib/fan-page/schema/documentV1'
import { resolveThemeColors } from '@/lib/fan-page/theme/resolveThemeColors'
import type { FanPageTheme } from '@/lib/fan-page/schema/documentV1'
import { FanPageImage } from './FanPageImage'

interface MerchBlockProps {
  shopUrl?: string
  image?: FanPageImageProps
  theme: FanPageTheme
  title?: string
  ctaLabel?: string
}

export function MerchBlock({ shopUrl, image, theme, title, ctaLabel = 'Shop Now' }: MerchBlockProps) {
  const colors = resolveThemeColors(theme)

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
      <div className="relative h-48 w-full overflow-hidden rounded-lg lg:h-56 lg:max-w-sm shrink-0">
        <FanPageImage image={image} alt={title ?? 'Merch'} fill width={600} />
      </div>
      <div className="flex-1">
        {title ? (
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: colors.primary }}>
            {title}
          </h2>
        ) : null}
        {shopUrl ? (
          <Button asChild className="mt-4" style={{ backgroundColor: colors.accent, color: colors.background }}>
            <a href={shopUrl} target="_blank" rel="noopener noreferrer">
              <ShoppingBag size={18} className="mr-2" aria-hidden />
              {ctaLabel}
            </a>
          </Button>
        ) : (
          <p className="mt-4 text-sm opacity-60">—</p>
        )}
      </div>
    </div>
  )
}