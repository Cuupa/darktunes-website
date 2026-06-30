'use client'

import { ArrowRight } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import type { FanPageImageProps } from '@/lib/fan-page/schema/documentV1'
import { resolveThemeColors } from '@/lib/fan-page/theme/resolveThemeColors'
import type { FanPageTheme } from '@/lib/fan-page/schema/documentV1'
import { FanPageImage } from './FanPageImage'

interface CtaBannerBlockProps {
  label?: string
  url?: string
  headline?: string
  image?: FanPageImageProps
  theme: FanPageTheme
}

export function CtaBannerBlock({ label = 'Learn More', url, headline, image, theme }: CtaBannerBlockProps) {
  const colors = resolveThemeColors(theme)

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10">
      {image?.src ? (
        <div className="absolute inset-0 opacity-30">
          <FanPageImage image={image} alt="" fill width={1200} />
        </div>
      ) : null}
      <div className="relative flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        {headline ? (
          <p className="text-xl font-bold tracking-tight sm:text-2xl" style={{ color: colors.primary }}>
            {headline}
          </p>
        ) : (
          <span />
        )}
        {url ? (
          <Button asChild size="lg" style={{ backgroundColor: colors.accent, color: colors.background }}>
            <a href={url} target="_blank" rel="noopener noreferrer">
              {label}
              <ArrowRight size={18} className="ml-2" aria-hidden />
            </a>
          </Button>
        ) : (
          <Button size="lg" disabled>
            {label}
          </Button>
        )}
      </div>
    </div>
  )
}